"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { flattenCommentPages } = require("./build-public-archive.js");
const {
  createPublicArchive,
  FORMAT_LINE,
  END_LINE,
  parseByte
} = require(path.join(__dirname, "..", "..", "docs", "app.js"));

const FEED_ISSUE_NUMBER = 1;
const REQUIRED_LABEL = "daily-byte-feed";
const SAFE_OUTPUT_TYPE = "publish_daily_dev_byte";
const DEFAULT_RECENT_LIMIT = 12;
const MAX_CONTEXT_BYTES = 16 * 1024;
const FALLBACK_SOURCES = Object.freeze([
  "https://git-scm.com/docs/git-fsck",
  "https://git-scm.com/docs/git-clean",
  "https://git-scm.com/docs/git-stash",
  "https://git-scm.com/docs/git-commit-graph",
  "https://git-scm.com/docs/git-maintenance"
]);
const FALLBACK_JOKES = Object.freeze([
  "ルート権限を取ったら、帰りのルートも決まった。",
  "ポートを開けたら、ボートが通った。",
  "キューが詰まって、急に困った。",
  "パッチを当てたら、ぱちっと直った。",
  "マージを待つ間、まあじっとしていよう。"
]);

function getIssueLabels(issue) {
  if (!issue || !Array.isArray(issue.labels)) {
    throw new Error("Issue metadata is invalid.");
  }

  return issue.labels.map((label) => (typeof label === "string" ? label : label.name));
}

function validateFeedIssue(issue) {
  if (!getIssueLabels(issue).includes(REQUIRED_LABEL)) {
    throw new Error(`Issue #${FEED_ISSUE_NUMBER} is missing the ${REQUIRED_LABEL} label.`);
  }
  if (issue.state && issue.state !== "open") {
    throw new Error(`Issue #${FEED_ISSUE_NUMBER} is not open.`);
  }
}

function getJstDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseCandidateBody(body) {
  if (typeof body !== "string") {
    throw new Error("Candidate body must be text.");
  }

  const normalized = body.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (
    lines.length !== 7 ||
    lines[0] !== FORMAT_LINE ||
    lines[6] !== END_LINE ||
    lines.some((line) => line.length === 0)
  ) {
    throw new Error("Candidate body must contain exactly the seven required non-empty lines.");
  }
  if (/redacted/i.test(normalized)) {
    throw new Error("Candidate body must not contain redacted content.");
  }

  const candidate = parseByte(normalized);
  if (/[()]/.test(candidate.sourceUrl)) {
    throw new Error("Candidate source URL must not contain parentheses.");
  }
  if (Array.from(candidate.joke).length > 160) {
    throw new Error("Candidate joke must not exceed 160 characters.");
  }

  return { ...candidate, body: normalized };
}

function getValidEntries(pages) {
  const archive = createPublicArchive(flattenCommentPages(pages));
  return {
    entries: archive.entries,
    invalidCount: archive.invalidCount,
    generatedCount: archive.generatedCount
  };
}

function buildCompactFeedContext(
  issue,
  pages,
  recentLimit = DEFAULT_RECENT_LIMIT,
  now = new Date()
) {
  validateFeedIssue(issue);
  if (!Number.isInteger(recentLimit) || recentLimit < 1) {
    throw new TypeError("Recent entry limit must be a positive integer.");
  }

  const { entries, invalidCount, generatedCount } = getValidEntries(pages);
  const publicationDate = getJstDate(now);
  const recentEntries = entries.slice(0, recentLimit).map((entry) => ({
    date: entry.date,
    fact: entry.fact,
    joke: entry.joke,
    source: entry.sourceUrl
  }));
  const base = {
    schema: "DAILY_DEV_BYTE_CONTEXT_V1",
    issue: {
      number: FEED_ISSUE_NUMBER,
      title: issue.title,
      labels: getIssueLabels(issue)
    },
    valid_history_count: entries.length,
    invalid_generated_count: invalidCount,
    generated_comment_count: generatedCount,
    publication_date: publicationDate,
    today_already_published: entries.some((entry) => entry.date === publicationDate),
    available_fallback_jokes: FALLBACK_JOKES.filter(
      (joke) => !entries.some((entry) => entry.joke === joke)
    ),
    available_fallback_sources: FALLBACK_SOURCES.filter(
      (source) => !entries.some((entry) => entry.sourceUrl === source)
    )
  };

  while (true) {
    const context = {
      ...base,
      recent_entry_count: recentEntries.length,
      recent_entries: recentEntries
    };
    if (Buffer.byteLength(JSON.stringify(context), "utf8") <= MAX_CONTEXT_BYTES) {
      return context;
    }
    if (recentEntries.length === 0) {
      break;
    }
    recentEntries.pop();
  }

  throw new Error("Compressed feed context exceeds the maximum size.");
}

function validateCandidateAgainstHistory(body, issue, pages, now = new Date()) {
  validateFeedIssue(issue);
  const candidate = parseCandidateBody(body);
  if (candidate.date !== getJstDate(now)) {
    throw new Error(`Candidate date must equal the current Asia/Tokyo date (${getJstDate(now)}).`);
  }

  const { entries } = getValidEntries(pages);
  const duplicateDate = entries.find((entry) => entry.date === candidate.date);
  if (duplicateDate) {
    throw new Error(`An entry is already published for ${candidate.date}.`);
  }
  const duplicateJoke = entries.find((entry) => entry.joke === candidate.joke);
  if (duplicateJoke) {
    throw new Error(`Candidate JOKE duplicates the entry published on ${duplicateJoke.date}.`);
  }
  const duplicateSource = entries.find((entry) => entry.sourceUrl === candidate.sourceUrl);
  if (duplicateSource) {
    throw new Error(`Candidate SOURCE duplicates the entry published on ${duplicateSource.date}.`);
  }
  const duplicateFact = entries.find((entry) => entry.fact === candidate.fact);
  if (duplicateFact) {
    throw new Error(`Candidate FACT duplicates the entry published on ${duplicateFact.date}.`);
  }

  return candidate;
}

function extractCandidateBody(agentOutput) {
  if (!agentOutput || !Array.isArray(agentOutput.items)) {
    throw new Error("Agent safe-output data is invalid.");
  }

  const items = agentOutput.items.filter((item) => item.type === SAFE_OUTPUT_TYPE);
  if (items.length !== 1 || typeof items[0].body !== "string") {
    throw new Error("Exactly one publish_daily_dev_byte item with a body is required.");
  }
  return items[0].body;
}

function runGh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"]
  });
}

function readJsonFromGh(args) {
  return JSON.parse(runGh(args));
}

function publishFromSafeOutput() {
  const outputPath = process.env.GH_AW_AGENT_OUTPUT;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!outputPath || !repository) {
    throw new Error("Required safe-output environment variables are missing.");
  }

  const agentOutput = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const issue = readJsonFromGh([
    "api",
    `repos/${repository}/issues/${FEED_ISSUE_NUMBER}`,
    "--jq",
    "{title, state, labels: [.labels[].name]}"
  ]);
  const pages = readJsonFromGh([
    "api",
    "--paginate",
    "--slurp",
    `repos/${repository}/issues/${FEED_ISSUE_NUMBER}/comments?per_page=100`
  ]);
  const candidate = validateCandidateAgainstHistory(
    extractCandidateBody(agentOutput),
    issue,
    pages
  );

  if (process.env.GH_AW_SAFE_OUTPUTS_STAGED === "true") {
    process.stdout.write(`${JSON.stringify({ staged: true, candidate })}\n`);
    return;
  }

  const result = readJsonFromGh([
    "api",
    "--method",
    "POST",
    `repos/${repository}/issues/${FEED_ISSUE_NUMBER}/comments`,
    "--raw-field",
    `body=${candidate.body}`,
    "--jq",
    "{html_url: .html_url}"
  ]);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function writeCompactContext(issuePath, recentLimit) {
  const issue = JSON.parse(fs.readFileSync(issuePath, "utf8"));
  const pages = JSON.parse(fs.readFileSync(0, "utf8"));
  const context = buildCompactFeedContext(issue, pages, recentLimit);
  process.stdout.write(JSON.stringify(context));
}

if (require.main === module) {
  const [, , command, issuePath, limitValue] = process.argv;
  if (command === "context" && issuePath) {
    const recentLimit = limitValue ? Number.parseInt(limitValue, 10) : DEFAULT_RECENT_LIMIT;
    writeCompactContext(issuePath, recentLimit);
  } else if (command === "publish") {
    publishFromSafeOutput();
  } else {
    throw new Error(
      "Usage: node daily-dev-byte-feed.js context <issue-json> [recent-limit] | publish"
    );
  }
}

module.exports = {
  DEFAULT_RECENT_LIMIT,
  FALLBACK_JOKES,
  FALLBACK_SOURCES,
  MAX_CONTEXT_BYTES,
  SAFE_OUTPUT_TYPE,
  buildCompactFeedContext,
  extractCandidateBody,
  getJstDate,
  parseCandidateBody,
  validateCandidateAgainstHistory,
  validateFeedIssue
};

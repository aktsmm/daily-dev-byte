"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MARKER,
  END_MARKER,
  FORMAT_LINE,
  END_LINE,
  WORKFLOW_CALL_MARKER,
  classifyHttpError,
  getDemoState,
  getSafeHostname,
  getStateView,
  isAllowedSourceUrl,
  isGeneratedComment,
  parseByte,
  readFeed,
  selectNewestMarkedComment
} = require("../docs/app.js");

const fact = "あ".repeat(120);
const agentMarker =
  "<!-- gh-aw-agentic-workflow: Daily Dev Byte Publisher, engine: copilot, version: 1.0.65, model: claude-sonnet-4.6, id: 1, workflow_id: daily-dev-byte, run: https://github.com/aktsmm/daily-dev-byte/actions/runs/1 -->";
const firstRunBody = [
  "DATE: 2026-07-16",
  "CATEGORY: コマンド/ショートカットTip",
  "FACT: git stash コマンドは、コミット前の変更を一時的にスタックへ退避させます。git stash list で退避一覧を確認し、git stash pop で最新の退避を復元・削除できます。ブランチを切り替えたいが作業途中のときに特に便利です。",
  "JOKE: なぜプログラマーはお風呂が好き?...バグ(垢)が取れるから!",
  "SOURCE: (gitscm.com/redacted)",
  "",
  "<!-- gh-aw-agentic-workflow: Daily Dev Byte Publisher, engine: copilot, version: 1.0.65, model: claude-sonnet-4.6, id: 29457658857, workflow_id: daily-dev-byte, run: https://github.com/aktsmm/daily-dev-byte/actions/runs/29457658857 -->",
  WORKFLOW_CALL_MARKER
].join("\n");

function body(overrides = {}) {
  return [
    FORMAT_LINE,
    `DATE: ${overrides.date || "2026-07-16"}`,
    `CATEGORY: ${overrides.category || "GitHub/Gitトリビア"}`,
    `FACT: ${overrides.fact || fact}`,
    `JOKE: ${overrides.joke || "Gitの調子がいいと、コミット気分も上々です。"}`,
    `SOURCE: ${overrides.source || "https://docs.github.com/en/rest/issues/comments"}`,
    END_LINE,
    "",
    overrides.marker || agentMarker
  ].join("\n");
}

function legacyBody() {
  return [
    MARKER,
    "DATE: 2026-07-16",
    "CATEGORY: GitHub/Gitトリビア",
    `FACT: ${fact}`,
    "JOKE: Gitの調子がいいと、コミット気分も上々です。",
    "SOURCE: https://docs.github.com/en/rest/issues/comments",
    END_MARKER
  ].join("\n");
}

function comment(commentBody, createdAt, id) {
  return {
    body: commentBody,
    created_at: createdAt,
    html_url: `https://github.com/aktsmm/daily-dev-byte/issues/1#issuecomment-${id}`
  };
}

test("parses the visible seven-line Daily Dev Byte contract", () => {
  assert.deepEqual(parseByte(body()), {
    date: "2026-07-16",
    category: "GitHub/Gitトリビア",
    fact,
    joke: "Gitの調子がいいと、コミット気分も上々です。",
    sourceUrl: "https://docs.github.com/en/rest/issues/comments"
  });
});

test("retains backward compatibility with legacy HTML sentinels", () => {
  assert.equal(parseByte(legacyBody()).fact, fact);
});

test("recognizes automatic gh-aw markers and ignores unrelated visible text", () => {
  assert.equal(isGeneratedComment(body()), true);
  assert.equal(isGeneratedComment(`${FORMAT_LINE}\nnot a workflow comment`), false);
  assert.equal(isGeneratedComment(`noise\n${WORKFLOW_CALL_MARKER}`), true);
});

test("selects the newest generated comment regardless of input order", () => {
  const oldComment = comment(body(), "2026-07-15T00:00:00Z", 1);
  const newComment = comment(body(), "2026-07-16T00:00:00Z", 2);
  assert.equal(selectNewestMarkedComment([oldComment, { body: "noise" }, newComment]), newComment);
});

test("falls back to an older valid comment when the newest generated comment is invalid", () => {
  const result = readFeed([
    comment(body(), "2026-07-15T00:00:00Z", 1),
    comment(firstRunBody, "2026-07-16T00:00:00Z", 2)
  ]);
  assert.equal(result.state, "ready");
  assert.match(result.byte.commentUrl, /issuecomment-1$/);
});

test("distinguishes no generated comments from generated but malformed comments", () => {
  assert.deepEqual(readFeed([{ body: `${FORMAT_LINE}\nunrelated` }]), { state: "empty" });
  assert.equal(readFeed([comment(firstRunBody, "2026-07-16T00:00:00Z", 2)]).state, "malformed");
});

test("rejects missing sentinels, redacted sources, and disallowed hosts", () => {
  assert.throws(() => parseByte(body().replace(`${END_LINE}\n`, "")));
  assert.throws(() => parseByte(body({ source: "https://git-scm.com/(redacted)" })));
  assert.throws(() => parseByte(body({ source: "https://example.com/reference" })));
  assert.throws(() => parseByte(body({ source: "https://docs.github.com/" })));
});

test("rejects unsafe URLs and out-of-range facts", () => {
  assert.throws(() => parseByte(body({ source: "javascript:alert(1)" })));
  assert.throws(() => parseByte(body({ fact: "短すぎます" })));
});

test("keeps HTML-looking content as inert parser output", () => {
  const htmlLikeFact = `<img src=x onerror=alert(1)>${"い".repeat(100)}`;
  assert.equal(parseByte(body({ fact: htmlLikeFact })).fact, htmlLikeFact);
});

test("enforces the curated HTTPS source allowlist", () => {
  assert.equal(isAllowedSourceUrl("https://git-scm.com/docs/git-rev-parse"), true);
  assert.equal(isAllowedSourceUrl("http://git-scm.com/docs/git-rev-parse"), false);
  assert.equal(isAllowedSourceUrl("https://evil.example/docs"), false);
  assert.equal(getSafeHostname("https://docs.github.com/en/rest"), "docs.github.com");
  assert.throws(() => getSafeHostname("https://example.com/docs"));
});

test("classifies rate limits only when GitHub reports exhausted quota", () => {
  const headers = (remaining) => ({ get: () => remaining });
  assert.equal(
    classifyHttpError({ ok: false, status: 403, headers: headers("0") }),
    "rate-limit"
  );
  assert.equal(
    classifyHttpError({ ok: false, status: 403, headers: headers("42") }),
    "api-error"
  );
  assert.equal(classifyHttpError({ ok: false, status: 429, headers: headers(null) }), "rate-limit");
  assert.equal(classifyHttpError({ ok: true, status: 200, headers: headers("59") }), null);
});

test("provides timeless, distinct, actionable view models", () => {
  assert.equal(getStateView("loading").retry, false);
  assert.equal(getStateView("empty").feed, true);
  assert.doesNotMatch(getStateView("empty").message, /認証/);
  assert.equal(getStateView("malformed").alert, true);
  assert.equal(getStateView("network").title, "GitHubへ接続できません");
  assert.equal(getStateView("rate-limit").label, "API利用上限");
  assert.throws(() => getStateView("unknown"));
});

test("accepts only allowlisted demo states", () => {
  assert.equal(getDemoState("?demoState=success"), "success");
  assert.equal(getDemoState("?demoState=rate-limit&scoutTheme=dark"), "rate-limit");
  assert.equal(getDemoState("?demoState=%3Cscript%3E"), null);
});

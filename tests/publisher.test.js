"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_RECENT_LIMIT,
  FALLBACK_JOKES,
  FALLBACK_SOURCES,
  MAX_CONTEXT_BYTES,
  buildCompactFeedContext,
  extractCandidateBody,
  parseCandidateBody,
  validateCandidateAgainstHistory
} = require("../.github/scripts/daily-dev-byte-feed.js");

const fact = (character) => character.repeat(120);
const issue = {
  title: "Daily Dev Byte Feed",
  state: "open",
  labels: ["daily-byte-feed"]
};

function body(overrides = {}) {
  return [
    "FORMAT: DAILY_DEV_BYTE_V1",
    `DATE: ${overrides.date || "2026-09-01"}`,
    `CATEGORY: ${overrides.category || "GitHub/Gitトリビア"}`,
    `FACT: ${overrides.fact || fact("あ")}`,
    `JOKE: ${overrides.joke || "ポートを開けたら、ボートが通った。"}`,
    `SOURCE: ${overrides.source || "https://git-scm.com/docs/git-fsck"}`,
    "END: DAILY_DEV_BYTE_V1"
  ].join("\n");
}

function comment(overrides = {}, id = 1, createdAt = "2026-09-01T00:00:00Z") {
  return {
    body: body(overrides),
    created_at: createdAt,
    html_url: `https://github.com/aktsmm/daily-dev-byte/issues/1#issuecomment-${id}`,
    user: { login: "github-actions[bot]", type: "Bot" }
  };
}

test("builds bounded context from recent facts and fallback availability", () => {
  const comments = Array.from({ length: 15 }, (_, index) =>
    comment(
      {
        date: `2026-08-${String(index + 1).padStart(2, "0")}`,
        fact: fact(String.fromCharCode(0x3042 + index)),
        joke: `ジョーク${index}`,
        source: `https://git-scm.com/docs/git-test-${index}`
      },
      index + 1,
      `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00Z`
    )
  );

  const context = buildCompactFeedContext(
    issue,
    [comments],
    DEFAULT_RECENT_LIMIT,
    new Date("2026-09-01T06:00:00Z")
  );

  assert.equal(context.recent_entry_count, DEFAULT_RECENT_LIMIT);
  assert.equal(context.publication_date, "2026-09-01");
  assert.equal(context.today_already_published, false);
  assert.equal(context.recent_entries[0].date, "2026-08-15");
  assert.deepEqual(context.available_fallback_jokes, FALLBACK_JOKES);
  assert.deepEqual(context.available_fallback_sources, FALLBACK_SOURCES);
  assert.ok(Buffer.byteLength(JSON.stringify(context), "utf8") <= MAX_CONTEXT_BYTES);
  assert.doesNotMatch(JSON.stringify(context), /html_url|github-actions\[bot\]/);
});

test("builds a valid bounded context when the feed has no history", () => {
  const context = buildCompactFeedContext(
    issue,
    [],
    DEFAULT_RECENT_LIMIT,
    new Date("2026-09-01T06:00:00Z")
  );

  assert.equal(context.valid_history_count, 0);
  assert.equal(context.recent_entry_count, 0);
  assert.equal(context.today_already_published, false);
  assert.deepEqual(context.recent_entries, []);
  assert.deepEqual(context.available_fallback_jokes, FALLBACK_JOKES);
  assert.deepEqual(context.available_fallback_sources, FALLBACK_SOURCES);
});

test("removes previously used values from the bounded fallback lists", () => {
  const context = buildCompactFeedContext(issue, [
    comment({
      joke: FALLBACK_JOKES[0],
      source: FALLBACK_SOURCES[0]
    })
  ]);

  assert.deepEqual(context.available_fallback_jokes, FALLBACK_JOKES.slice(1));
  assert.deepEqual(context.available_fallback_sources, FALLBACK_SOURCES.slice(1));
});

test("flags an existing publication date and rejects same-day reruns", () => {
  const history = [comment({ date: "2026-09-01", fact: fact("い") })];
  const now = new Date("2026-09-01T06:00:00Z");
  const context = buildCompactFeedContext(issue, history, DEFAULT_RECENT_LIMIT, now);

  assert.equal(context.today_already_published, true);
  assert.throws(
    () => validateCandidateAgainstHistory(body(), issue, history, now),
    /already published for 2026-09-01/
  );
});

test("rejects exact JOKE and SOURCE collisions before publication", () => {
  const history = [
    comment({
      date: "2026-08-31",
      joke: "キューが詰まって、急に困った。",
      source: "https://git-scm.com/docs/git-clean"
    })
  ];
  const now = new Date("2026-09-01T06:00:00Z");

  assert.throws(
    () =>
      validateCandidateAgainstHistory(
        body({ joke: "キューが詰まって、急に困った。" }),
        issue,
        history,
        now
      ),
    /JOKE duplicates/
  );
  assert.throws(
    () =>
      validateCandidateAgainstHistory(
        body({ source: "https://git-scm.com/docs/git-clean" }),
        issue,
        history,
        now
      ),
    /SOURCE duplicates/
  );
});

test("allows historical duplicates while validating only the new candidate", () => {
  const duplicate = {
    joke: "古い重複ジョーク",
    source: "https://git-scm.com/docs/git-name-rev"
  };
  const history = [
    comment({ ...duplicate, date: "2026-08-31", fact: fact("い") }, 1),
    comment({ ...duplicate, date: "2026-08-06", fact: fact("う") }, 2)
  ];

  assert.doesNotThrow(() =>
    validateCandidateAgainstHistory(
      body(),
      issue,
      history,
      new Date("2026-09-01T06:00:00Z")
    )
  );
});

test("enforces the issue label, publication date, and exact seven-line contract", () => {
  assert.throws(
    () =>
      validateCandidateAgainstHistory(
        body(),
        { ...issue, labels: [] },
        [],
        new Date("2026-09-01T06:00:00Z")
      ),
    /missing the daily-byte-feed label/
  );
  assert.throws(
    () =>
      validateCandidateAgainstHistory(
        body({ date: "2026-09-02" }),
        issue,
        [],
        new Date("2026-09-01T06:00:00Z")
      ),
    /Asia\/Tokyo date/
  );
  assert.throws(() => parseCandidateBody(`${body()}\n`), /exactly the seven required/);
  assert.throws(
    () => parseCandidateBody(body({ source: "https://git-scm.com/docs/(redacted)" })),
    /redacted/
  );
});

test("requires exactly one custom safe-output candidate", () => {
  assert.equal(
    extractCandidateBody({
      items: [{ type: "publish_daily_dev_byte", body: body() }]
    }),
    body()
  );
  assert.throws(
    () =>
      extractCandidateBody({
        items: [
          { type: "publish_daily_dev_byte", body: body() },
          { type: "publish_daily_dev_byte", body: body() }
        ]
      }),
    /Exactly one/
  );
});

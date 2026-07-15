"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MARKER,
  END_MARKER,
  classifyHttpError,
  getDemoState,
  getSafeHostname,
  getStateView,
  parseByte,
  readFeed,
  selectNewestMarkedComment
} = require("../docs/app.js");

const fact = "あ".repeat(120);

function body(overrides = {}) {
  return [
    MARKER,
    `DATE: ${overrides.date || "2026-07-16"}`,
    `CATEGORY: ${overrides.category || "GitHub/Gitトリビア"}`,
    `FACT: ${overrides.fact || fact}`,
    `JOKE: ${overrides.joke || "Gitの調子がいいと、コミット気分も上々です。"}`,
    `SOURCE: ${overrides.source || "https://docs.github.com/example"}`,
    END_MARKER
  ].join("\n");
}

test("parses the strict Daily Dev Byte format", () => {
  assert.deepEqual(parseByte(body()), {
    date: "2026-07-16",
    category: "GitHub/Gitトリビア",
    fact,
    joke: "Gitの調子がいいと、コミット気分も上々です。",
    sourceUrl: "https://docs.github.com/example"
  });
});

test("selects the newest marked comment regardless of input order", () => {
  const oldComment = { body: body(), created_at: "2026-07-15T00:00:00Z" };
  const newComment = { body: body(), created_at: "2026-07-16T00:00:00Z" };
  assert.equal(selectNewestMarkedComment([oldComment, { body: "noise" }, newComment]), newComment);
});

test("reports empty and malformed feed states separately", () => {
  assert.deepEqual(readFeed([{ body: "ordinary comment" }]), { state: "empty" });
  const malformed = readFeed([
    {
      body: `${MARKER}\nDATE: broken\n${END_MARKER}`,
      created_at: "2026-07-16T00:00:00Z",
      html_url: "https://github.com/aktsmm/daily-dev-byte/issues/1#issuecomment-1"
    }
  ]);
  assert.equal(malformed.state, "malformed");
});

test("rejects unsafe source URLs and out-of-range facts", () => {
  assert.throws(() => parseByte(body({ source: "javascript:alert(1)" })));
  assert.throws(() => parseByte(body({ fact: "短すぎます" })));
});

test("keeps HTML-looking content as inert parser output", () => {
  const htmlLikeFact = `<img src=x onerror=alert(1)>${"い".repeat(100)}`;
  assert.equal(parseByte(body({ fact: htmlLikeFact })).fact, htmlLikeFact);
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

test("provides distinct actionable view models", () => {
  assert.equal(getStateView("loading").retry, false);
  assert.equal(getStateView("empty").feed, true);
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

test("extracts hostnames only from HTTPS URLs", () => {
  assert.equal(getSafeHostname("https://docs.github.com/en/rest"), "docs.github.com");
  assert.throws(() => getSafeHostname("http://example.com"));
  assert.throws(() => getSafeHostname("javascript:alert(1)"));
});

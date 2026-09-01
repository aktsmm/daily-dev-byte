"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const workflow = fs
  .readFileSync(path.join(root, ".github", "workflows", "daily-dev-byte.md"), "utf8")
  .replace(/\r\n/g, "\n");
const archiveWorkflow = fs
  .readFileSync(
    path.join(root, ".github", "workflows", "publish-daily-dev-byte-archive.yml"),
    "utf8"
  )
  .replace(/\r\n/g, "\n");
const compiledWorkflow = fs
  .readFileSync(path.join(root, ".github", "workflows", "daily-dev-byte.lock.yml"), "utf8")
  .replace(/\r\n/g, "\n");

test("requires an identifiable phonetic pun pair and rejects technical metaphors", () => {
  assert.match(workflow, /identical or clearly similar Japanese sounds in different meanings/);
  assert.match(workflow, /internally name the exact two expressions and their different meanings/);
  assert.match(
    workflow,
    /Gitで道に迷っても大丈夫、reflogが“来た道”を思い出させてくれます。/
  );
  assert.match(workflow, /only a technical metaphor; it has no phonetic pun pair/);
});

test("uses bounded deterministic context and ordered fallback pools", () => {
  assert.match(workflow, /cat \/tmp\/gh-aw\/agent\/feed-context\.json` exactly once/);
  assert.match(workflow, /at most the 12 most recent valid entries/);
  assert.match(workflow, /available_fallback_jokes/);
  assert.match(workflow, /available_fallback_sources/);
  assert.match(workflow, /This ordered fallback pool is deterministic/);

  const fallbackEntries =
    workflow.match(/^\s+\d+\. `[^`\n]+` \(`[^`\n]+`[^\n]*\)$/gm) || [];
  assert.equal(fallbackEntries.length, 5);
  const fallbackSources =
    workflow.match(/^\s+\d+\. `https:\/\/git-scm\.com\/docs\/[^`\n]+`$/gm) || [];
  assert.equal(fallbackSources.length, 5);
});

test("preserves the exact seven-line publication contract", () => {
  const outputBlock = workflow.match(/```text\n([\s\S]*?)\n```/);
  assert.ok(outputBlock);
  assert.deepEqual(outputBlock[1].split("\n"), [
    "FORMAT: DAILY_DEV_BYTE_V1",
    "DATE: YYYY-MM-DD",
    "CATEGORY: one exact category value from the list above",
    "FACT: Japanese fact of 100-200 Unicode characters on one line",
    "JOKE: one workplace-safe Japanese dad joke on one line",
    "SOURCE: one direct https URL that supports the central claim",
    "END: DAILY_DEV_BYTE_V1"
  ]);
});

test("publishes a deterministic archive after the publisher completes", () => {
  assert.match(workflow, /Issue #1 remains the append-only source of truth/);
  assert.match(archiveWorkflow, /workflow_run:/);
  assert.match(archiveWorkflow, /workflows: \["Daily Dev Byte Publisher"\]/);
  assert.match(archiveWorkflow, /issues: read/);
  assert.match(archiveWorkflow, /contents: write/);
  assert.match(archiveWorkflow, /build-public-archive\.js/);
  assert.match(archiveWorkflow, /docs\/archive\.json/);
});

test("prepares feed history outside the model and publishes through a gated safe output", () => {
  assert.doesNotMatch(workflow, /mode: gh-proxy/);
  assert.match(workflow, /checkout: false/);
  assert.match(workflow, /github: false/);
  assert.match(workflow, /edit: false/);
  assert.match(workflow, /jobs:\n  prepare_feed_context:/);
  assert.match(workflow, /context: \$\{\{ steps\.context\.outputs\.context \}\}/);
  assert.match(workflow, /should_publish: \$\{\{ steps\.context\.outputs\.should_publish \}\}/);
  assert.match(workflow, /agent:\n    if: needs\.prepare_feed_context\.outputs\.should_publish == 'true'/);
  assert.match(workflow, /name: Prepare bounded feed context/);
  assert.match(workflow, /daily-dev-byte-feed\.js context/);
  assert.match(workflow, /FEED_CONTEXT: \$\{\{ needs\.prepare_feed_context\.outputs\.context \}\}/);
  assert.match(workflow, /name: Materialize bounded feed context/);
  assert.match(workflow, /test "\$\(wc -c < \/tmp\/gh-aw\/agent\/feed-context\.json\)" -le 16384/);
  assert.match(workflow, /jobs:\n    publish-daily-dev-byte:/);
  assert.match(workflow, /if: needs\.detection\.outputs\.detection_success == 'true'/);
  assert.match(workflow, /daily-dev-byte-feed\.js publish/);
  assert.match(compiledWorkflow, /shell\(cat\)/);
  assert.doesNotMatch(compiledWorkflow, /shell\(gh:\*\)/);
});

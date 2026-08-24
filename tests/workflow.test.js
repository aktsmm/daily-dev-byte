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

test("checks recent JOKE fields and provides an ordered deterministic fallback pool", () => {
  assert.match(workflow, /extract both the fact subjects and the `JOKE` fields/);
  assert.match(workflow, /do not reuse the same pun pair from a recent joke/i);
  assert.match(workflow, /This ordered fallback pool is deterministic/);

  const fallbackEntries =
    workflow.match(/^\s+\d+\. `[^`\n]+` \(`[^`\n]+`[^\n]*\)$/gm) || [];
  assert.equal(fallbackEntries.length, 5);
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

test("reads the feed through the authenticated GitHub proxy without local parsing", () => {
  assert.match(workflow, /github:\n    mode: gh-proxy\n    toolsets: \[issues\]/);
  assert.match(workflow, /Use the pre-authenticated `gh` CLI only for GitHub reads/);
  assert.match(workflow, /issues\/1" --jq/);
  assert.match(workflow, /comments\?per_page=100/);
  assert.match(workflow, /Do not write API responses to local files or use `read`, Python/);
  assert.match(compiledWorkflow, /shell\(gh:\*\)/);
});

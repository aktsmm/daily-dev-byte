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

test("uses the recovery compiler baseline with matching runtime and action pins", () => {
  const metadata = JSON.parse(compiledWorkflow.match(/^# gh-aw-metadata: (.+)$/m)[1]);
  const version = metadata.compiler_version;
  assert.match(version, /^v\d+\.\d+\.\d+$/);
  const [major, minor, patch] = version.slice(1).split(".").map(Number);
  assert.ok(
    major > 0 || minor > 88 || (minor === 88 && patch >= 8),
    "Recompile with gh-aw v0.88.8 or newer; do not restore the blocked v0.82.9 lock file"
  );
  assert.equal(metadata.strict, true);

  const actionLock = JSON.parse(
    fs.readFileSync(path.join(root, ".github", "aw", "actions-lock.json"), "utf8")
  );
  const setupPin = actionLock.entries[`github/gh-aw-actions/setup@${version}`];
  assert.ok(setupPin);
  assert.equal(setupPin.version, version);
  assert.match(setupPin.sha, /^[a-f0-9]{40}$/);

  const setupUses = [...compiledWorkflow.matchAll(/uses: github\/gh-aw-actions\/setup@(\S+)/g)];
  assert.ok(setupUses.length > 0);
  for (const [, sha] of setupUses) assert.equal(sha, setupPin.sha);

  const runtimeVersions = [
    ...compiledWorkflow.matchAll(/GH_AW_COMPILED_VERSION: "?([^"\n]+)"?/g)
  ];
  assert.ok(runtimeVersions.length > 0);
  for (const [, runtimeVersion] of runtimeVersions) assert.equal(runtimeVersion, version);
  assert.match(compiledWorkflow, /name: Check compile-agentic version/);
  assert.match(compiledWorkflow, /check_version_updates\.cjs/);
});

test("preserves publication limits and authentication after recompilation", () => {
  assert.match(compiledWorkflow, /cron: "0 23 \* \* \*"/);
  assert.match(compiledWorkflow, /copilot-requests: write/);
  assert.match(compiledWorkflow, /GH_AW_MAX_DAILY_AI_CREDITS: "2000"/);

  const configLine = compiledWorkflow.match(/GH_AW_SAFE_OUTPUTS_HANDLER_CONFIG: (.+)/);
  assert.ok(configLine);
  const config = JSON.parse(JSON.parse(configLine[1]));
  assert.deepEqual(config.add_comment, {
    footer: false,
    max: 1,
    required_labels: ["daily-byte-feed"],
    target: "1"
  });
});

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

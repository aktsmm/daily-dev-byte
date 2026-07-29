"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "docs", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "docs", "styles.css"), "utf8");
const js = fs.readFileSync(path.join(root, "docs", "app.js"), "utf8");

const requiredThemeVariables = [
  "--cp-bg",
  "--cp-bg-elevated",
  "--cp-surface",
  "--cp-surface-soft",
  "--cp-border",
  "--cp-border-strong",
  "--cp-text",
  "--cp-text-muted",
  "--cp-text-soft",
  "--cp-accent",
  "--cp-accent-hover",
  "--cp-accent-soft",
  "--cp-accent-fg",
  "--cp-success",
  "--cp-danger",
  "--cp-warning",
  "--cp-link",
  "--cp-shadow",
  "--cp-overlay",
  "--cp-panel",
  "--cp-panel-strong",
  "--cp-sheen",
  "--cp-highlight",
  "--cp-card-shadow"
];

test("loads the mandatory theme detector before application JavaScript", () => {
  const detector = html.indexOf('get("scoutTheme")');
  const application = html.indexOf('src="app.js"');
  assert.ok(detector > 0);
  assert.ok(application > detector);
  assert.match(html, /document\.documentElement\.setAttribute\("data-theme", theme\)/);
});

test("defines every Clawpilot variable for both themes", () => {
  for (const variable of requiredThemeVariables) {
    const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const definitions = css.match(new RegExp(`^\\s*${escaped}:`, "gm")) || [];
    assert.equal(definitions.length, 2, `${variable} must exist in light and dark`);
  }
  assert.match(
    css,
    /font-family: "Segoe UI", Aptos, Calibri, -apple-system, BlinkMacSystemFont, sans-serif/
  );
  assert.doesNotMatch(css, /linear-gradient|radial-gradient|font-family: Inter/);
  const definedVariables = [...css.matchAll(/^\s*(--cp-[\w-]+):/gm)].map((match) => match[1]);
  assert.deepEqual(
    [...new Set(definedVariables)].sort(),
    requiredThemeVariables.slice().sort(),
    "the mandatory Clawpilot variable set must remain exact"
  );
});

test("uses Clawpilot variables for every component color", () => {
  const componentCss = css
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--cp-"))
    .join("\n");
  assert.doesNotMatch(componentCss, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
});

test("includes semantic landmarks, archive disclosure, state, proof, and workflow links", () => {
  assert.match(html, /<main id="main">/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="retry-button"/);
  assert.match(html, /id="archive-section"/);
  assert.match(html, /id="archive-list"/);
  assert.match(html, /id="archive-toggle"/);
  assert.match(html, /aria-controls="archive-list"/);
  assert.match(html, />これまでのByte</);
  assert.match(html, /id="source-host"/);
  assert.match(html, /daily-dev-byte\.md/);
  assert.match(html, /daily-dev-byte\.lock\.yml/);
  assert.match(html, /issues\/1/);
  assert.match(css, /\[hidden\]\s*\{\s*display: none !important;/);
});

test("provides persistent accessible links to every related demo", () => {
  const demoNav = html.match(/<nav class="demo-nav" aria-label="関連デモ">([\s\S]*?)<\/nav>/);
  assert.ok(demoNav);

  const links = [
    "https://aktsmm.github.io/azure-ops-pulse-demo/#/overview",
    "https://aktsmm.github.io/m365-message-center-dashboard/",
    "https://aktsmm.github.io/m365-copilot-update-digest/",
    "https://aktsmm.github.io/daily-dev-byte/",
    "https://aktsmm.github.io/vscode-copilot-digest/index.html"
  ];
  for (const href of links) {
    assert.match(demoNav[1], new RegExp(`href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }

  assert.match(
    demoNav[1],
    /href="https:\/\/aktsmm\.github\.io\/daily-dev-byte\/" aria-current="page"/
  );
  assert.doesNotMatch(demoNav[1], /target="_blank"/);
  assert.match(css, /\.site-header\s*\{\s*position: sticky;/);
  assert.match(css, /\.demo-nav a\[aria-current="page"\]/);
});

test("never renders untrusted content through innerHTML", () => {
  assert.doesNotMatch(js, /\.innerHTML|insertAdjacentHTML|document\.write/);
  assert.match(js, /textContent = byte\.fact/);
  assert.match(js, /textContent = byte\.joke/);
  assert.match(js, /getSafeHostname\(byte\.sourceUrl\)/);
  assert.match(js, /replaceChildren\(\.\.\.visibleEntries\.map\(createArchiveCard\)\)/);
  assert.match(js, /configureExternalLink\(commentLink, byte\.commentUrl, "comment"\)/);
  assert.match(js, /aria-live", view\.alert \? "assertive" : "polite"/);
});

test("loads the same-origin public archive rather than the GitHub API", () => {
  assert.match(js, /const ARCHIVE_URL = "archive\.json";/);
  assert.match(js, /fetchImpl\(ARCHIVE_URL, \{ cache: "no-store" \}\)/);
  assert.doesNotMatch(js, /api\.github\.com/);
  assert.doesNotMatch(js, /x-ratelimit-remaining/);
  assert.match(js, /archive-unavailable/);
});

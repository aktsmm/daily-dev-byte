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
  "--cp-highlight"
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
});

test("includes semantic landmarks, retry, state, proof, and workflow links", () => {
  assert.match(html, /<main id="main">/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="retry-button"/);
  assert.match(html, /id="source-host"/);
  assert.match(html, /daily-dev-byte\.md/);
  assert.match(html, /daily-dev-byte\.lock\.yml/);
  assert.match(html, /issues\/1/);
  assert.match(css, /\[hidden\]\s*\{\s*display: none !important;/);
});

test("never renders untrusted content through innerHTML", () => {
  assert.doesNotMatch(js, /\.innerHTML|insertAdjacentHTML|document\.write/);
  assert.match(js, /textContent = byte\.fact/);
  assert.match(js, /textContent = byte\.joke/);
  assert.match(js, /getSafeHostname\(byte\.sourceUrl\)/);
});

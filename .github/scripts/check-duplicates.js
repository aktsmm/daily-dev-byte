"use strict";

// Detects repeated subjects/jokes in the generated feed. Exit 1 when the
// newest entry repeats an earlier fact subject (same key terms) or joke.
const fs = require("node:fs");
const path = require("node:path");
const { createPublicArchive } = require(path.join(__dirname, "..", "..", "docs", "app.js"));
const { flattenCommentPages } = require("./build-public-archive.js");

const STOP = /[\s、。，．・「」『』（）()\[\]【】,.:;!?！？\-\u3000]/g;

function normalize(text) {
  return String(text).replace(STOP, "").toLowerCase();
}

function bigrams(text) {
  const t = normalize(text);
  const set = new Set();
  for (let i = 0; i < t.length - 1; i += 1) {
    set.add(t.slice(i, i + 2));
  }
  return set;
}

function similarity(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const g of A) if (B.has(g)) shared += 1;
  return shared / Math.min(A.size, B.size);
}

function findRepeats(entries, { factThreshold = 0.55, jokeThreshold = 0.8 } = {}) {
  const [latest, ...older] = entries;
  const repeats = [];
  if (!latest) return repeats;
  for (const prev of older) {
    const fact = similarity(latest.fact, prev.fact);
    const joke = similarity(latest.joke, prev.joke);
    if (fact >= factThreshold) repeats.push({ kind: "fact", date: prev.date, score: fact });
    if (joke >= jokeThreshold) repeats.push({ kind: "joke", date: prev.date, score: joke });
  }
  return repeats;
}

if (require.main === module) {
  const pages = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const archive = createPublicArchive(flattenCommentPages(pages));
  const entries = archive.entries || [];
  const repeats = findRepeats(entries);
  console.log(`entries=${entries.length} latest=${entries[0] && entries[0].date}`);
  for (const r of repeats) console.log(`REPEAT ${r.kind} of ${r.date} (${r.score.toFixed(2)})`);
  process.exit(repeats.length ? 1 : 0);
}

module.exports = { findRepeats, similarity };

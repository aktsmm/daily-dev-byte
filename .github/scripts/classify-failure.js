"use strict";

// Decides how the heal workflow reacts to a failed publisher run.
// Usage: node classify-failure.js <event> <attempt> < run.log  -> prints safe|rerun|none
const DENIAL_LINE = /tool denial \d+\/\d+/;

function classifyFailure({ event, attempt, log }) {
  const denied = DENIAL_LINE.test(log);
  if (denied && event === "workflow_dispatch") return "none";
  if (denied) return "safe";
  if (String(attempt) === "1") return "rerun";
  return "none";
}

if (require.main === module) {
  const [, , event, attempt] = process.argv;
  let log = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    log += chunk;
  });
  process.stdin.on("end", () => {
    process.stdout.write(`${classifyFailure({ event, attempt, log })}\n`);
  });
}

module.exports = { classifyFailure, DENIAL_LINE };

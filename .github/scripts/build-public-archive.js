"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createPublicArchive } = require(path.join(__dirname, "..", "..", "docs", "app.js"));

function flattenCommentPages(pages) {
  if (!Array.isArray(pages)) {
    throw new TypeError("GitHub comment response must be an array.");
  }
  if (pages.every(Array.isArray)) {
    return pages.flat();
  }
  if (pages.some(Array.isArray)) {
    throw new TypeError("GitHub comment response must not mix pages and comments.");
  }
  return pages;
}

function buildPublicArchive(pages) {
  return createPublicArchive(flattenCommentPages(pages));
}

function writePublicArchive(inputPath, outputPath) {
  const pages = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const archive = buildPublicArchive(pages);
  fs.writeFileSync(outputPath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");
  return archive;
}

if (require.main === module) {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    throw new Error("Usage: node build-public-archive.js <comments-json> <archive-json>");
  }
  writePublicArchive(inputPath, outputPath);
}

module.exports = { buildPublicArchive, flattenCommentPages, writePublicArchive };

(function (root) {
  "use strict";

  const API_URL =
    "https://api.github.com/repos/aktsmm/daily-dev-byte/issues/1/comments?per_page=100&sort=created&direction=desc";
  const MARKER = "<!-- DAILY_DEV_BYTE_V1 -->";
  const END_MARKER = "<!-- /DAILY_DEV_BYTE_V1 -->";
  const CATEGORIES = new Set([
    "GitHub/Gitトリビア",
    "今日にまつわるIT史",
    "最近のGitHubアップデート",
    "コマンド/ショートカットTip",
    "有名なバグ/障害/失敗談"
  ]);

  function characterCount(value) {
    return Array.from(value).length;
  }

  function isHttpsUrl(value) {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }

  function isGitHubCommentUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "github.com";
    } catch {
      return false;
    }
  }

  function parseByte(body) {
    if (typeof body !== "string") {
      throw new Error("Comment body is not text.");
    }

    const start = body.indexOf(MARKER);
    const end = body.indexOf(END_MARKER, start + MARKER.length);
    if (start === -1 || end === -1) {
      throw new Error("Daily Dev Byte markers are incomplete.");
    }

    const block = body.slice(start + MARKER.length, end).trim();
    const match = block.match(
      /^DATE: (\d{4}-\d{2}-\d{2})\nCATEGORY: ([^\n]+)\nFACT: ([^\n]+)\nJOKE: ([^\n]+)\nSOURCE: (https:\/\/[^\s]+)$/
    );
    if (!match) {
      throw new Error("Daily Dev Byte fields do not match the required format.");
    }

    const [, date, category, fact, joke, sourceUrl] = match;
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      throw new Error("Publication date is invalid.");
    }
    if (!CATEGORIES.has(category)) {
      throw new Error("Category is invalid.");
    }
    if (characterCount(fact) < 100 || characterCount(fact) > 200) {
      throw new Error("Fact must contain 100 to 200 characters.");
    }
    if (!joke.trim() || joke.includes("\n")) {
      throw new Error("Dad joke must be one non-empty line.");
    }
    if (!isHttpsUrl(sourceUrl)) {
      throw new Error("Source URL must use HTTPS.");
    }

    return { date, category, fact, joke, sourceUrl };
  }

  function selectNewestMarkedComment(comments) {
    if (!Array.isArray(comments)) {
      throw new TypeError("GitHub API response is not an array.");
    }

    return comments
      .filter((comment) => comment && typeof comment.body === "string" && comment.body.includes(MARKER))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] || null;
  }

  function readFeed(comments) {
    const comment = selectNewestMarkedComment(comments);
    if (!comment) {
      return { state: "empty" };
    }

    try {
      const byte = parseByte(comment.body);
      if (!isGitHubCommentUrl(comment.html_url)) {
        throw new Error("GitHub comment URL is invalid.");
      }
      return { state: "ready", byte: { ...byte, commentUrl: comment.html_url } };
    } catch (error) {
      return { state: "malformed", error };
    }
  }

  function showStatus(message, isError) {
    const status = document.getElementById("status");
    status.hidden = false;
    status.classList.toggle("is-error", Boolean(isError));
    status.querySelector(".loader").hidden = true;
    document.getElementById("status-message").textContent = message;
    document.getElementById("byte-card").hidden = true;
  }

  function renderByte(byte) {
    const status = document.getElementById("status");
    const card = document.getElementById("byte-card");
    const date = document.getElementById("byte-date");
    const sourceLink = document.getElementById("source-link");
    const commentLink = document.getElementById("comment-link");

    date.dateTime = byte.date;
    date.textContent = byte.date;
    document.getElementById("byte-category").textContent = byte.category;
    document.getElementById("byte-fact").textContent = byte.fact;
    document.getElementById("byte-joke").textContent = byte.joke;
    sourceLink.href = byte.sourceUrl;
    sourceLink.rel = "noopener noreferrer";
    sourceLink.target = "_blank";
    commentLink.href = byte.commentUrl;
    commentLink.rel = "noopener noreferrer";
    commentLink.target = "_blank";

    status.hidden = true;
    card.hidden = false;
  }

  async function loadLatestByte(fetchImpl) {
    let response;
    try {
      response = await fetchImpl(API_URL, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });
    } catch {
      showStatus("ネットワークに接続できません。時間をおいて再読み込みしてください。", true);
      return;
    }

    if (response.status === 403 || response.status === 429) {
      showStatus("GitHub APIの利用上限に達しました。時間をおいて再読み込みしてください。", true);
      return;
    }
    if (!response.ok) {
      showStatus(`GitHub APIから取得できませんでした（HTTP ${response.status}）。`, true);
      return;
    }

    let comments;
    try {
      comments = await response.json();
    } catch {
      showStatus("GitHub APIの応答を読み取れませんでした。", true);
      return;
    }

    let result;
    try {
      result = readFeed(comments);
    } catch {
      showStatus("GitHub APIの応答形式が正しくありません。", true);
      return;
    }

    if (result.state === "empty") {
      showStatus("まだDaily Dev Byteは公開されていません。最初の投稿をお待ちください。", false);
    } else if (result.state === "malformed") {
      showStatus("最新のDaily Dev Byteを解析できませんでした。フィードの形式を確認してください。", true);
    } else {
      renderByte(result.byte);
    }
  }

  const api = { MARKER, END_MARKER, parseByte, readFeed, selectNewestMarkedComment };
  root.DailyDevByte = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => loadLatestByte(root.fetch.bind(root)));
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

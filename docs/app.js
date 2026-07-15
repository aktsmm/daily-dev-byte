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
  const DEMO_STATES = new Set([
    "loading",
    "empty",
    "success",
    "malformed",
    "network",
    "rate-limit",
    "api-error"
  ]);
  const STATE_VIEWS = Object.freeze({
    loading: {
      label: "GitHub API",
      title: "最新データを取得中",
      message: "公開フィードから最新の投稿を読み込んでいます。",
      icon: "↻",
      retry: false,
      feed: false,
      alert: false
    },
    empty: {
      label: "公開待ち",
      title: "最初のByteを準備しています",
      message:
        "フィードにはまだ生成済みの投稿がありません。現在は認証設定前のため、この空状態が正常です。",
      icon: "○",
      retry: true,
      feed: true,
      alert: false
    },
    malformed: {
      label: "形式エラー",
      title: "最新の投稿を表示できません",
      message:
        "投稿は見つかりましたが、Daily Dev Byteの公開形式と一致しません。フィードで元データを確認できます。",
      icon: "!",
      retry: true,
      feed: true,
      alert: true
    },
    network: {
      label: "接続エラー",
      title: "GitHubへ接続できません",
      message: "ネットワーク接続を確認してから、もう一度お試しください。",
      icon: "×",
      retry: true,
      feed: false,
      alert: true
    },
    "rate-limit": {
      label: "API利用上限",
      title: "しばらく待ってから再試行してください",
      message:
        "未認証のGitHub API利用上限に達しました。通常は時間をおくと自動的に利用できるようになります。",
      icon: "!",
      retry: true,
      feed: false,
      alert: true
    },
    "api-error": {
      label: "GitHub API",
      title: "公開フィードを取得できません",
      message: "GitHub APIから正常な応答がありませんでした。時間をおいて再試行してください。",
      icon: "×",
      retry: true,
      feed: false,
      alert: true
    }
  });
  const DEMO_BYTE = Object.freeze({
    date: "2026-07-16",
    category: "GitHub/Gitトリビア",
    fact:
      "Gitのコミットはファイル差分そのものではなく、プロジェクト全体のスナップショットを指すオブジェクトです。各コミットは親コミットとツリー、作者などを参照し、その内容から計算されたハッシュで識別されます。この構造が履歴の追跡と改ざん検知を支えています。",
    joke: "コミットの前では、悩みもきっと「差分」になります。",
    sourceUrl: "https://git-scm.com/book/ja/v2/Gitの内側-Gitオブジェクト",
    commentUrl: "https://github.com/aktsmm/daily-dev-byte/issues/1"
  });

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

  function getSafeHostname(value) {
    if (!isHttpsUrl(value)) {
      throw new Error("URL must use HTTPS.");
    }
    return new URL(value).hostname;
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

    return (
      comments
        .filter(
          (comment) => comment && typeof comment.body === "string" && comment.body.includes(MARKER)
        )
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] || null
    );
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

  function classifyHttpError(response) {
    if (response && response.ok) {
      return null;
    }

    const remaining =
      response && response.headers && typeof response.headers.get === "function"
        ? response.headers.get("x-ratelimit-remaining")
        : null;
    if (response && (response.status === 429 || (response.status === 403 && remaining === "0"))) {
      return "rate-limit";
    }
    return "api-error";
  }

  function getStateView(state) {
    const view = STATE_VIEWS[state];
    if (!view) {
      throw new Error(`Unknown view state: ${state}`);
    }
    return { ...view };
  }

  function getDemoState(search) {
    const value = new URLSearchParams(search).get("demoState");
    return DEMO_STATES.has(value) ? value : null;
  }

  function renderState(state, options = {}) {
    const view = getStateView(state);
    const panel = document.getElementById("state-panel");
    const icon = document.getElementById("state-icon");
    const retry = document.getElementById("retry-button");
    const feedLink = document.getElementById("state-feed-link");

    panel.hidden = false;
    panel.dataset.state = state;
    panel.setAttribute("role", view.alert ? "alert" : "status");
    panel.setAttribute("aria-busy", state === "loading" ? "true" : "false");
    icon.textContent = view.icon;
    icon.classList.toggle("is-spinning", state === "loading");
    document.getElementById("state-label").textContent = view.label;
    document.getElementById("state-title").textContent = view.title;
    document.getElementById("state-message").textContent = options.message || view.message;
    retry.hidden = !view.retry;
    feedLink.hidden = !view.feed;
    document.getElementById("byte-card").hidden = true;

    if (options.focus) {
      panel.focus();
    }
  }

  function renderByte(byte, options = {}) {
    const panel = document.getElementById("state-panel");
    const card = document.getElementById("byte-card");
    const date = document.getElementById("byte-date");
    const sourceLink = document.getElementById("source-link");
    const commentLink = document.getElementById("comment-link");

    date.dateTime = byte.date;
    date.textContent = byte.date;
    document.getElementById("byte-category").textContent = byte.category;
    document.getElementById("byte-fact").textContent = byte.fact;
    document.getElementById("byte-joke").textContent = byte.joke;
    document.getElementById("source-host").textContent = getSafeHostname(byte.sourceUrl);
    sourceLink.href = byte.sourceUrl;
    sourceLink.rel = "noopener noreferrer";
    sourceLink.target = "_blank";
    commentLink.href = byte.commentUrl;
    commentLink.rel = "noopener noreferrer";
    commentLink.target = "_blank";

    panel.hidden = true;
    card.hidden = false;
    if (options.focus) {
      card.focus();
    }
  }

  async function loadLatestByte(fetchImpl, options = {}) {
    renderState("loading");

    let response;
    try {
      response = await fetchImpl(API_URL, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });
    } catch {
      renderState("network", { focus: options.focus });
      return;
    }

    const httpError = classifyHttpError(response);
    if (httpError) {
      const message =
        httpError === "api-error"
          ? `GitHub APIから正常な応答がありませんでした（HTTP ${response.status}）。時間をおいて再試行してください。`
          : undefined;
      renderState(httpError, { focus: options.focus, message });
      return;
    }

    let comments;
    try {
      comments = await response.json();
    } catch {
      renderState("malformed", {
        focus: options.focus,
        message: "GitHub APIの応答をJSONとして読み取れませんでした。"
      });
      return;
    }

    let result;
    try {
      result = readFeed(comments);
    } catch {
      renderState("malformed", {
        focus: options.focus,
        message: "GitHub APIの応答構造が期待した形式ではありません。"
      });
      return;
    }

    if (result.state === "empty") {
      renderState("empty", { focus: options.focus });
    } else if (result.state === "malformed") {
      renderState("malformed", { focus: options.focus });
    } else {
      renderByte(result.byte, { focus: options.focus });
    }
  }

  function renderDemoState(state, options = {}) {
    if (state === "success") {
      renderByte(DEMO_BYTE, options);
    } else {
      renderState(state, options);
    }
  }

  function init() {
    const demoState = getDemoState(root.location.search);
    const fetchImpl = root.fetch.bind(root);
    const retry = document.getElementById("retry-button");

    retry.addEventListener("click", () => {
      if (demoState) {
        renderDemoState(demoState, { focus: true });
      } else {
        loadLatestByte(fetchImpl, { focus: true });
      }
    });

    if (demoState) {
      renderDemoState(demoState);
    } else {
      loadLatestByte(fetchImpl);
    }
  }

  const api = {
    MARKER,
    END_MARKER,
    classifyHttpError,
    getDemoState,
    getSafeHostname,
    getStateView,
    parseByte,
    readFeed,
    selectNewestMarkedComment
  };
  root.DailyDevByte = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", init);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

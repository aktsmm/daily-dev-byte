(function (root) {
  "use strict";

  const API_URL =
    "https://api.github.com/repos/aktsmm/daily-dev-byte/issues/1/comments?per_page=100&sort=created&direction=desc";
  const MARKER = "<!-- DAILY_DEV_BYTE_V1 -->";
  const END_MARKER = "<!-- /DAILY_DEV_BYTE_V1 -->";
  const FORMAT_LINE = "FORMAT: DAILY_DEV_BYTE_V1";
  const END_LINE = "END: DAILY_DEV_BYTE_V1";
  const WORKFLOW_CALL_MARKER =
    "<!-- gh-aw-workflow-call-id: aktsmm/daily-dev-byte/daily-dev-byte -->";
  const ARCHIVE_PAGE_SIZE = 6;
  const ALLOWED_SOURCE_HOSTS = new Set([
    "docs.github.com",
    "github.blog",
    "git-scm.com",
    "www.kernel.org",
    "www.rfc-editor.org",
    "www.computerhistory.org",
    "nvd.nist.gov",
    "learn.microsoft.com"
  ]);
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
      title: "公開履歴を取得中",
      message: "Issue #1から最新の投稿と、これまでのByteを読み込んでいます。",
      icon: "↻",
      retry: false,
      feed: false,
      alert: false
    },
    empty: {
      label: "公開待ち",
      title: "最初のByteを準備しています",
      message: "公開形式を満たす投稿はまだありません。次回のワークフロー実行後にご確認ください。",
      icon: "○",
      retry: true,
      feed: true,
      alert: false
    },
    malformed: {
      label: "表示できる投稿なし",
      title: "有効なByteが見つかりません",
      message:
        "生成コメントはありますが、現在の公開形式で安全に表示できる投稿がありません。Issue #1で元データを確認できます。",
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
      title: "公開履歴を取得できません",
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
    joke: "コミットを忘れるなんて、こみっともない！",
    sourceUrl: "https://git-scm.com/book/ja/v2/Gitの内側-Gitオブジェクト",
    commentUrl:
      "https://github.com/aktsmm/daily-dev-byte/issues/1#issuecomment-2000000000",
    createdAt: "2026-07-16T00:00:00Z"
  });

  let currentArchiveEntries = [];
  let archiveExpanded = false;

  function characterCount(value) {
    return Array.from(value).length;
  }

  function isAllowedSourceUrl(value) {
    if (typeof value !== "string" || /redacted/i.test(value)) {
      return false;
    }

    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        ALLOWED_SOURCE_HOSTS.has(url.hostname) &&
        url.pathname !== "/"
      );
    } catch {
      return false;
    }
  }

  function isGitHubCommentUrl(value) {
    if (typeof value !== "string") {
      return false;
    }

    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        url.hostname === "github.com" &&
        url.pathname === "/aktsmm/daily-dev-byte/issues/1" &&
        !url.search &&
        /^#issuecomment-\d+$/.test(url.hash)
      );
    } catch {
      return false;
    }
  }

  function getSafeHostname(value) {
    if (!isAllowedSourceUrl(value)) {
      throw new Error("URL must be a direct HTTPS page on the source allowlist.");
    }
    return new URL(value).hostname;
  }

  function validateByteFields(date, category, fact, joke, sourceUrl) {
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
    if (!isAllowedSourceUrl(sourceUrl)) {
      throw new Error("Source URL must be a direct HTTPS page on the source allowlist.");
    }

    return { date, category, fact, joke, sourceUrl };
  }

  function parseByte(body) {
    if (typeof body !== "string") {
      throw new Error("Comment body is not text.");
    }

    const visibleStart = body.indexOf(FORMAT_LINE);
    if (visibleStart !== -1) {
      const visibleEnd = body.indexOf(END_LINE, visibleStart + FORMAT_LINE.length);
      if (visibleEnd === -1) {
        throw new Error("Daily Dev Byte visible sentinels are incomplete.");
      }

      const block = body.slice(visibleStart, visibleEnd + END_LINE.length).trim();
      const match = block.match(
        /^FORMAT: DAILY_DEV_BYTE_V1\nDATE: (\d{4}-\d{2}-\d{2})\nCATEGORY: ([^\n]+)\nFACT: ([^\n]+)\nJOKE: ([^\n]+)\nSOURCE: (https:\/\/[^\s]+)\nEND: DAILY_DEV_BYTE_V1$/
      );
      if (!match) {
        throw new Error("Daily Dev Byte fields do not match the visible contract.");
      }

      return validateByteFields(...match.slice(1));
    }

    const legacyStart = body.indexOf(MARKER);
    const legacyEnd = body.indexOf(END_MARKER, legacyStart + MARKER.length);
    if (legacyStart === -1 || legacyEnd === -1) {
      throw new Error("Daily Dev Byte sentinels are missing.");
    }

    const block = body.slice(legacyStart + MARKER.length, legacyEnd).trim();
    const match = block.match(
      /^DATE: (\d{4}-\d{2}-\d{2})\nCATEGORY: ([^\n]+)\nFACT: ([^\n]+)\nJOKE: ([^\n]+)\nSOURCE: (https:\/\/[^\s]+)$/
    );
    if (!match) {
      throw new Error("Daily Dev Byte fields do not match the required format.");
    }

    return validateByteFields(...match.slice(1));
  }

  function isGeneratedComment(body) {
    if (typeof body !== "string") {
      return false;
    }

    const hasAgentMarker =
      body.includes("<!-- gh-aw-agentic-workflow:") &&
      /(?:^|[,\s])workflow_id: daily-dev-byte(?:,|\s|-->)/.test(body);
    return (
      hasAgentMarker ||
      body.includes(WORKFLOW_CALL_MARKER) ||
      body.includes(FORMAT_LINE) ||
      body.includes(MARKER)
    );
  }

  function isTrustedPublisher(comment) {
    return Boolean(
      comment &&
        comment.user &&
        comment.user.login === "github-actions[bot]" &&
        comment.user.type === "Bot"
    );
  }

  function selectGeneratedComments(comments) {
    if (!Array.isArray(comments)) {
      throw new TypeError("GitHub API response is not an array.");
    }

    return comments
      .filter((comment) => isTrustedPublisher(comment) && isGeneratedComment(comment.body))
      .sort((a, b) => {
        const newer = Date.parse(b.created_at);
        const older = Date.parse(a.created_at);
        return (Number.isFinite(newer) ? newer : 0) - (Number.isFinite(older) ? older : 0);
      });
  }

  function selectNewestMarkedComment(comments) {
    return selectGeneratedComments(comments)[0] || null;
  }

  function splitHeroAndArchive(entries) {
    if (!Array.isArray(entries)) {
      throw new TypeError("Entries must be an array.");
    }
    return {
      hero: entries[0] || null,
      archiveEntries: entries.slice(1)
    };
  }

  function getVisibleArchiveEntries(entries, expanded, limit = ARCHIVE_PAGE_SIZE) {
    if (!Array.isArray(entries) || !Number.isInteger(limit) || limit < 1) {
      throw new TypeError("Archive entries and limit are invalid.");
    }
    return expanded ? entries.slice() : entries.slice(0, limit);
  }

  function getArchiveDisclosureState(total, expanded, limit = ARCHIVE_PAGE_SIZE) {
    if (!Number.isInteger(total) || total < 0 || !Number.isInteger(limit) || limit < 1) {
      throw new TypeError("Archive disclosure values are invalid.");
    }
    return {
      hidden: total <= limit,
      expanded: total > limit && Boolean(expanded),
      label: total > limit && expanded ? "閉じる" : `もっと見る（残り${Math.max(total - limit, 0)}件）`
    };
  }

  function readFeed(comments) {
    const generatedComments = selectGeneratedComments(comments);
    if (generatedComments.length === 0) {
      return { state: "empty" };
    }

    const entries = [];
    let invalidCount = 0;
    let lastError;

    for (const comment of generatedComments) {
      try {
        const byte = parseByte(comment.body);
        if (!isGitHubCommentUrl(comment.html_url)) {
          throw new Error("GitHub comment URL is invalid.");
        }
        if (!Number.isFinite(Date.parse(comment.created_at))) {
          throw new Error("GitHub comment timestamp is invalid.");
        }
        entries.push({
          ...byte,
          commentUrl: comment.html_url,
          createdAt: comment.created_at
        });
      } catch (error) {
        invalidCount += 1;
        lastError = error;
      }
    }

    entries.sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
        Date.parse(`${b.date}T00:00:00Z`) - Date.parse(`${a.date}T00:00:00Z`)
    );

    if (entries.length === 0) {
      return {
        state: "malformed",
        entries: [],
        invalidCount,
        generatedCount: generatedComments.length,
        error: lastError
      };
    }

    const { hero, archiveEntries } = splitHeroAndArchive(entries);
    return {
      state: "ready",
      entries,
      byte: hero,
      hero,
      archiveEntries,
      invalidCount,
      generatedCount: generatedComments.length
    };
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

  function configureExternalLink(link, url, kind) {
    const isSafe = kind === "source" ? isAllowedSourceUrl(url) : isGitHubCommentUrl(url);
    if (!isSafe) {
      throw new Error("External link is not allowed.");
    }
    link.href = url;
    link.rel = "noopener noreferrer";
    link.target = "_blank";
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (typeof text === "string") {
      element.textContent = text;
    }
    return element;
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
    panel.setAttribute("aria-live", view.alert ? "assertive" : "polite");
    panel.setAttribute("aria-busy", state === "loading" ? "true" : "false");
    icon.textContent = view.icon;
    icon.classList.toggle("is-spinning", state === "loading");
    document.getElementById("state-label").textContent = view.label;
    document.getElementById("state-title").textContent = view.title;
    document.getElementById("state-message").textContent = options.message || view.message;
    retry.hidden = !view.retry;
    feedLink.hidden = !view.feed;
    document.getElementById("byte-card").hidden = true;
    document.getElementById("archive-section").hidden = true;

    if (options.focus) {
      panel.focus();
    }
  }

  function renderHero(byte, options = {}) {
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
    configureExternalLink(sourceLink, byte.sourceUrl, "source");
    configureExternalLink(commentLink, byte.commentUrl, "comment");

    panel.hidden = true;
    card.hidden = false;
    if (options.focus) {
      card.focus();
    }
  }

  function createArchiveCard(byte) {
    const article = createElement("article", "archive-card");
    const header = createElement("header", "archive-card-header");
    const titleWrap = createElement("div", "archive-title");
    const date = createElement("time", "archive-date", byte.date);
    date.dateTime = byte.date;
    const category = createElement("p", "archive-category", byte.category);
    titleWrap.append(date, category);

    const commentLink = createElement("a", "archive-comment-link", "GitHubコメント ↗");
    configureExternalLink(commentLink, byte.commentUrl, "comment");
    header.append(titleWrap, commentLink);

    const fact = createElement("p", "archive-fact", byte.fact);
    const jokeWrap = createElement("div", "archive-joke");
    jokeWrap.append(
      createElement("p", "archive-label", "DAD JOKE"),
      createElement("p", "archive-joke-copy", byte.joke)
    );

    const sourceLink = createElement("a", "archive-source", `出典: ${getSafeHostname(byte.sourceUrl)} ↗`);
    configureExternalLink(sourceLink, byte.sourceUrl, "source");
    article.append(header, fact, jokeWrap, sourceLink);
    return article;
  }

  function renderArchiveList() {
    const list = document.getElementById("archive-list");
    const empty = document.getElementById("archive-empty");
    const summary = document.getElementById("archive-summary");
    const disclosure = document.getElementById("archive-toggle");
    const visibleEntries = getVisibleArchiveEntries(currentArchiveEntries, archiveExpanded);
    const disclosureState = getArchiveDisclosureState(
      currentArchiveEntries.length,
      archiveExpanded
    );

    list.replaceChildren(...visibleEntries.map(createArchiveCard));
    empty.hidden = currentArchiveEntries.length !== 0;
    list.hidden = currentArchiveEntries.length === 0;
    disclosure.hidden = disclosureState.hidden;
    disclosure.setAttribute("aria-expanded", String(disclosureState.expanded));
    disclosure.textContent = disclosureState.label;

    if (currentArchiveEntries.length === 0) {
      summary.textContent = "過去の有効なByteはまだありません。";
    } else if (disclosureState.expanded) {
      summary.textContent = `これまでのByte 全${currentArchiveEntries.length}件を表示しています。`;
    } else {
      summary.textContent = `これまでのByte ${visibleEntries.length}件を表示しています。`;
    }
  }

  function setArchiveExpanded(expanded) {
    archiveExpanded = Boolean(expanded);
    renderArchiveList();
  }

  function renderFeed(result, options = {}) {
    renderHero(result.hero, options);
    currentArchiveEntries = result.archiveEntries.slice();
    archiveExpanded = false;

    const archiveSection = document.getElementById("archive-section");
    const qualityNote = document.getElementById("data-quality-note");
    qualityNote.hidden = result.invalidCount === 0;
    qualityNote.textContent =
      result.invalidCount > 0
        ? `表示形式を満たさない生成コメント ${result.invalidCount}件は一覧から除外しています。`
        : "";
    archiveSection.hidden = false;
    renderArchiveList();
  }

  async function loadFeed(fetchImpl, options = {}) {
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
      renderFeed(result, { focus: options.focus });
    }
  }

  function createDemoFeed() {
    const entries = Array.from({ length: 9 }, (_, index) => {
      const day = String(16 - index).padStart(2, "0");
      return {
        ...DEMO_BYTE,
        date: `2026-07-${day}`,
        commentUrl: `https://github.com/aktsmm/daily-dev-byte/issues/1#issuecomment-${
          2000000000 - index
        }`,
        createdAt: `2026-07-${day}T00:00:00Z`
      };
    });
    const { hero, archiveEntries } = splitHeroAndArchive(entries);
    return { state: "ready", entries, hero, archiveEntries, invalidCount: 1 };
  }

  function renderDemoState(state, options = {}) {
    if (state === "success") {
      renderFeed(createDemoFeed(), options);
    } else {
      renderState(state, options);
    }
  }

  function init() {
    const demoState = getDemoState(root.location.search);
    const fetchImpl = root.fetch.bind(root);
    const retry = document.getElementById("retry-button");
    const archiveToggle = document.getElementById("archive-toggle");

    retry.addEventListener("click", () => {
      if (demoState) {
        renderDemoState(demoState, { focus: true });
      } else {
        loadFeed(fetchImpl, { focus: true });
      }
    });
    archiveToggle.addEventListener("click", () => {
      setArchiveExpanded(!archiveExpanded);
    });

    if (demoState) {
      renderDemoState(demoState);
    } else {
      loadFeed(fetchImpl);
    }
  }

  const api = {
    API_URL,
    ARCHIVE_PAGE_SIZE,
    MARKER,
    END_MARKER,
    FORMAT_LINE,
    END_LINE,
    WORKFLOW_CALL_MARKER,
    classifyHttpError,
    getArchiveDisclosureState,
    getDemoState,
    getSafeHostname,
    getStateView,
    getVisibleArchiveEntries,
    isAllowedSourceUrl,
    isGeneratedComment,
    isGitHubCommentUrl,
    isTrustedPublisher,
    parseByte,
    readFeed,
    selectNewestMarkedComment,
    splitHeroAndArchive
  };
  root.DailyDevByte = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", init);
  }
})(typeof globalThis !== "undefined" ? globalThis : this);

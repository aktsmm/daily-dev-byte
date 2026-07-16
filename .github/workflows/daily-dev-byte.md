---
description: Publishes one verified Japanese Daily Dev Byte to the fixed feed issue
on:
  schedule:
    - cron: "0 23 * * *" # 08:00 Asia/Tokyo (JST, UTC+9)
  workflow_dispatch:
permissions:
  issues: read
engine:
  id: copilot
  copilot-sdk: true
  model: gpt-5.4
checkout: false
network:
  allowed:
    - "docs.github.com"
    - "github.blog"
    - "git-scm.com"
    - "www.kernel.org"
    - "www.rfc-editor.org"
    - "www.computerhistory.org"
    - "nvd.nist.gov"
    - "learn.microsoft.com"
tools:
  github:
    mode: gh-proxy
    toolsets: [issues]
  web-fetch:
  bash: ["curl"]
safe-outputs:
  add-comment:
    target: "1"
    required-labels: [daily-byte-feed]
    max: 1
    footer: false
max-ai-credits: 1000
max-daily-ai-credits: 2000
timeout-minutes: 10
---

# Daily Dev Byte Publisher

Issue #1 is the append-only publication feed for this repository. Publish exactly one verified Japanese IT fact and one separate Japanese dad joke.

## Required process

1. Use the GitHub issue tools to read the issue title, labels, and recent comments on issue #1. Do not probe tools or dates with shell commands; use the run context for the current date and invoke the declared tools directly.
2. Confirm that issue #1 has the `daily-byte-feed` label. If it does not, stop without requesting any safe output.
3. Extract the subjects of recent comments containing both `FORMAT: DAILY_DEV_BYTE_V1` and the automatic `workflow_id: daily-dev-byte` marker. Do not repeat or lightly rephrase a subject already present.
4. Select exactly one category:
   - `GitHub/Gitトリビア`
   - `今日にまつわるIT史`
   - `最近のGitHubアップデート`
   - `コマンド/ショートカットTip`
   - `有名なバグ/障害/失敗談`
   When using `今日にまつわるIT史`, the event must share today's month and day in Asia/Tokyo. When using `最近のGitHubアップデート`, confirm that the source identifies a concrete recent release or changelog entry.
5. Verify the central factual claim from the main agent with the direct source URL. Prefer the built-in tool whose exact name is `web_fetch` when it is available. If `web_fetch` is not listed in the active toolset, use the allowed `curl` shell command directly from the main agent instead: `curl --fail --silent --show-error --location --max-time 30 --proto '=https' "DIRECT_URL"`. Do not delegate retrieval to a task/research subagent, and do not use wget, Python, model memory, web search, a third-party search API, or an unlisted domain as a substitute for a successful direct fetch.
6. The `SOURCE` value must begin with exactly one of these prefixes and must include a direct page path after the host:
   - `https://docs.github.com/`
   - `https://github.blog/`
   - `https://git-scm.com/`
   - `https://www.kernel.org/`
   - `https://www.rfc-editor.org/`
   - `https://www.computerhistory.org/`
   - `https://nvd.nist.gov/`
   - `https://learn.microsoft.com/`
7. If the first idea cannot be retrieved and verified, discard it and choose another topic. The mandatory timeless fallback is Git revision parsing, using the known direct page `https://git-scm.com/docs/git-rev-parse`. Fetch that exact URL with `web_fetch`, or with the exact allowed `curl` command from step 5 when `web_fetch` is absent, before writing the fallback fact. If neither direct main-agent method can retrieve the fallback page, call `noop` with the reason and do not call `add-comment`.
8. Write the fact in natural Japanese using 100-200 Unicode characters, including punctuation. It must be accurate, useful, self-contained, and must not include Markdown links.
9. Write a separate one-line Japanese dad joke. It must be workplace-safe, non-discriminatory, non-sexual, and must not target or insult any person or group.
10. Perform the final self-check below. If any check fails, repair the body before calling a safe output. Never publish a body containing `redacted`, parentheses around the source, a homepage URL, or a source you did not successfully fetch.
11. Use the `add-comment` safe-output tool once with `item_number` set to `1` and the body in the exact format below. Do not add any text before `FORMAT` or after `END`. gh-aw appends its own workflow markers later; do not generate those markers yourself.

## Exact output format

Every field must occupy exactly one line. The body must contain exactly seven lines. Replace placeholders only. Do not use code fences, bullets, headings, extra whitespace, extra fields, HTML comments, or additional sources.

```text
FORMAT: DAILY_DEV_BYTE_V1
DATE: YYYY-MM-DD
CATEGORY: one exact category value from the list above
FACT: Japanese fact of 100-200 Unicode characters on one line
JOKE: one workplace-safe Japanese dad joke on one line
SOURCE: one direct https URL that supports the central claim
END: DAILY_DEV_BYTE_V1
```

## Mandatory final self-check

Before `add-comment`, verify all of the following:

- Line 1 equals `FORMAT: DAILY_DEV_BYTE_V1`.
- Line 7 equals `END: DAILY_DEV_BYTE_V1`.
- There are exactly seven non-empty lines in the order shown.
- `DATE` is the publication date in Asia/Tokyo.
- `CATEGORY` exactly matches one allowed category.
- `FACT` is 100-200 Unicode characters.
- `JOKE` is present on one separate line.
- `SOURCE` is byte-for-byte the exact URL passed to the successful `web_fetch` or `curl` call, starts with one allowed HTTPS prefix above, has a path after the host, and contains neither `redacted` nor parentheses.
- The subject is not duplicated in recent valid workflow comments.

If any item is false and cannot be repaired, use `noop` instead of publishing.

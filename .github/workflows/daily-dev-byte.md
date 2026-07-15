---
description: Publishes one verified Japanese Daily Dev Byte to the fixed feed issue
on:
  schedule:
    - cron: "0 23 * * *" # 08:00 Asia/Tokyo (JST, UTC+9)
  workflow_dispatch:
permissions:
  issues: read
engine: copilot
checkout: false
network:
  allowed:
    - "https://docs.github.com"
    - "https://github.blog"
    - "https://git-scm.com"
    - "https://www.kernel.org"
    - "https://www.rfc-editor.org"
    - "https://www.computerhistory.org"
    - "https://nvd.nist.gov"
    - "https://learn.microsoft.com"
tools:
  github:
    mode: gh-proxy
    toolsets: [issues]
  web-fetch:
  bash: []
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

1. Use the GitHub issue tools to read the issue title, labels, and recent comments on issue #1.
2. Confirm that issue #1 has the `daily-byte-feed` label. If it does not, stop without requesting any safe output.
3. Extract the subjects of recent comments containing `<!-- DAILY_DEV_BYTE_V1 -->`. Do not repeat or lightly rephrase a subject already present.
4. Select exactly one category:
   - `GitHub/Gitトリビア`
   - `今日にまつわるIT史`
   - `最近のGitHubアップデート`
   - `コマンド/ショートカットTip`
   - `有名なバグ/障害/失敗談`
   When using `今日にまつわるIT史`, the event must share today's month and day in Asia/Tokyo. When using `最近のGitHubアップデート`, confirm that the source identifies a concrete recent release or changelog entry.
5. Verify the central factual claim with `web-fetch`. Prefer primary or official sources. Do not use web search, a third-party search API, or an unlisted domain.
6. If the first idea cannot be verified from an allowed reliable source, discard it and choose another topic. The mandatory fallback is timeless Git or GitHub trivia verifiable at `https://git-scm.com/docs` or `https://docs.github.com/`.
7. Write the fact in natural Japanese using 100-200 Unicode characters, including punctuation. It must be accurate, useful, self-contained, and must not include Markdown links.
8. Write a separate one-line Japanese dad joke. It must be workplace-safe, non-discriminatory, non-sexual, and must not target or insult any person or group.
9. Use the `add-comment` safe-output tool once with `item_number` set to `1` and the body in the exact format below. Do not add any text before the opening marker or after the closing marker.

## Exact output format

Every field must occupy exactly one line. Replace placeholders only. Do not use code fences, bullets, headings, extra whitespace, extra fields, or additional sources.

```text
<!-- DAILY_DEV_BYTE_V1 -->
DATE: YYYY-MM-DD
CATEGORY: one exact category value from the list above
FACT: Japanese fact of 100-200 Unicode characters on one line
JOKE: one workplace-safe Japanese dad joke on one line
SOURCE: one direct https URL that supports the central claim
<!-- /DAILY_DEV_BYTE_V1 -->
```

`DATE` is the publication date in Asia/Tokyo. `SOURCE` must be the exact page fetched during verification, not a search-results page or an unverifiable homepage.

---
description: Publishes one verified Japanese Daily Dev Byte to the fixed feed issue
on:
  schedule:
    - cron: "0 23 * * *" # 08:00 Asia/Tokyo (JST, UTC+9)
  workflow_dispatch:
permissions:
  issues: read
  copilot-requests: write
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
    mode: local
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

1. Use the GitHub issue MCP tools directly to read the issue title, labels, and recent comments on issue #1. Do not use `gh`, shell tools, Python, or local files for this step; use the run context for the current date and invoke the declared tools directly.
2. Confirm that issue #1 has the `daily-byte-feed` label. If it does not, stop without requesting any safe output.
3. From recent comments containing both `FORMAT: DAILY_DEV_BYTE_V1` and the automatic `workflow_id: daily-dev-byte` marker, extract both the fact subjects and the `JOKE` fields. Internally identify each recent joke's pun pair when possible. Do not repeat or lightly rephrase a recent fact subject, and do not reuse the same pun pair from a recent joke.
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
9. Write a separate one-line Japanese dad joke that is a genuine phonetic dajare. It must use two words or phrases with identical or clearly similar Japanese sounds in different meanings. Merely mentioning a technical term in a metaphor, encouragement, rhyme-free sentence, or technical observation is invalid. It must be workplace-safe, non-discriminatory, non-sexual, and must not target or insult any person or group.
   - Positive examples that illustrate the quality bar only; vary the joke rather than copying an example by default:
     - `コミットを忘れるなんて、こみっともない！` (`コミット` / `こみっともない`)
     - `クラウドの請求額に、くらっとした。` (`クラウド` / `くらっと`)
     - `ブランチを切ったら、ランチにしよう。` (`ブランチ` / `ランチ`)
   - Negative examples:
     - `Gitで道に迷っても大丈夫、reflogが“来た道”を思い出させてくれます。` is only a technical metaphor; it has no phonetic pun pair.
     - `デプロイ成功で気分も上々です。` is only an observation; it has no phonetic pun pair.
   - Before publishing, internally name the exact two expressions and their different meanings. Do not add that reasoning or the pair to the seven-line output. If the pair cannot be named, reject the joke and regenerate it.
   - If generation still fails this gate, use the first entry below whose stated pun pair was not used in the recent valid workflow comments. This ordered fallback pool is deterministic; do not rewrite its selected entry:
     1. `バイト列を調べていたら、アルバイトの時間になった。` (`バイト`: byte / part-time job)
     2. `キャッシュを消したら、現金（cash）まで消えた。` (`キャッシュ` / `cash`: cache / cash)
     3. `コードレビューで「こうでいい？」と聞いてみた。` (`コード` / `こうで`: code / in this way)
     4. `データが見つかって、「出ーた！」と声が出た。` (`データ` / `出ーた`: data / found it)
     5. `サーバーを探していたら、「さあ、バーへ」と案内された。` (`サーバー` / `さあ、バー`: server / now, to the bar)
10. Perform the final self-check below. If any check fails, repair the body before calling a safe output. Never publish a body containing `redacted`, parentheses around the source, a homepage URL, or a source you did not successfully fetch.
11. Use the `add-comment` safe-output tool once with `item_number` set to `1` and the body in the exact format below. Do not add any text before `FORMAT` or after `END`. gh-aw appends its own workflow markers later; do not generate those markers yourself.
12. The deterministic `Publish Daily Dev Byte archive` workflow reads Issue #1 after this workflow succeeds. It independently validates only trusted generated comments and publishes the resulting same-origin Pages archive. Issue #1 remains the append-only source of truth; do not attempt to edit repository files or the archive from this workflow.

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
- The internal `JOKE` pun pair can be named as two identical or clearly similar Japanese sounds with different meanings, and that pair does not repeat a pair from recent valid workflow comments. If it cannot be named, reject and regenerate the joke; if generation still fails, select from the deterministic fallback pool in order.
- `SOURCE` is byte-for-byte the exact URL passed to the successful `web_fetch` or `curl` call, starts with one allowed HTTPS prefix above, has a path after the host, and contains neither `redacted` nor parentheses.
- The subject is not duplicated in recent valid workflow comments.

If any item is false and cannot be repaired, use `noop` instead of publishing.

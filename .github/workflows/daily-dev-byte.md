---
description: Publishes one verified Japanese Daily Dev Byte to the fixed feed issue
strict: true
on:
  schedule:
    - cron: "0 23 * * *" # 08:00 Asia/Tokyo (JST, UTC+9)
  workflow_dispatch:
permissions:
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
  github: false
  edit: false
  web-fetch:
  bash: [cat, curl]
jobs:
  prepare_feed_context:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: read
    outputs:
      context: ${{ steps.context.outputs.context }}
      should_publish: ${{ steps.context.outputs.should_publish }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - name: Prepare bounded feed context
        id: context
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          set -euo pipefail
          issue_file="${RUNNER_TEMP}/daily-dev-byte-issue.json"
          context_file="${RUNNER_TEMP}/daily-dev-byte-context.json"
          gh api "repos/${GITHUB_REPOSITORY}/issues/1" \
            --jq '{title, state, labels: [.labels[].name]}' > "${issue_file}"
          gh api --paginate --slurp \
            "repos/${GITHUB_REPOSITORY}/issues/1/comments?per_page=100" |
            node .github/scripts/daily-dev-byte-feed.js context "${issue_file}" 12 \
              > "${context_file}"
          test "$(wc -c < "${context_file}")" -le 16384
          printf 'context=%s\n' "$(cat "${context_file}")" >> "${GITHUB_OUTPUT}"
          printf 'should_publish=%s\n' "$(
            node -e 'const fs=require("fs");const c=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(String(!c.today_already_published))' "${context_file}"
          )" >> "${GITHUB_OUTPUT}"
  agent:
    if: needs.prepare_feed_context.outputs.should_publish == 'true'
steps:
  - name: Materialize bounded feed context
    env:
      FEED_CONTEXT: ${{ needs.prepare_feed_context.outputs.context }}
    run: |
      set -euo pipefail
      test -n "${FEED_CONTEXT}"
      mkdir -p /tmp/gh-aw/agent
      printf '%s' "${FEED_CONTEXT}" > /tmp/gh-aw/agent/feed-context.json
      test "$(wc -c < /tmp/gh-aw/agent/feed-context.json)" -le 16384
safe-outputs:
  report-failed-jobs: false
  jobs:
    publish-daily-dev-byte:
      description: Validate and publish exactly one Daily Dev Byte to Issue #1
      runs-on: ubuntu-latest
      if: needs.detection.outputs.detection_success == 'true'
      output: Daily Dev Byte published after deterministic duplicate validation.
      permissions:
        contents: read
        issues: write
      inputs:
        body:
          description: Exact seven-line DAILY_DEV_BYTE_V1 body
          required: true
          type: string
      steps:
        - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1  # v7.0.1
        - name: Validate candidate and publish comment
          env:
            GH_TOKEN: ${{ github.token }}
          run: node .github/scripts/daily-dev-byte-feed.js publish
max-ai-credits: 1000
max-daily-ai-credits: 2000
timeout-minutes: 10
---

# Daily Dev Byte Publisher

Issue #1 is the append-only publication feed for this repository. Publish exactly one verified Japanese IT fact and one separate Japanese dad joke.

## Required process

1. Run `cat /tmp/gh-aw/agent/feed-context.json` exactly once. This bounded JSON contains Issue #1 metadata, at most the 12 most recent valid entries, and ordered fallback JOKE/SOURCE values that remain unused across all valid history. A deterministic precondition skips the agent when `today_already_published` is true. Never call GitHub for feed history, inspect raw comment bodies, or read/view automatically created `copilot-tool-output` temporary files.
2. Confirm that the context has schema `DAILY_DEV_BYTE_CONTEXT_V1` and Issue #1 has the `daily-byte-feed` label. If either check fails, stop without requesting any safe output.
3. Use `recent_entries` to avoid repeating or lightly rephrasing a recent fact subject or pun pair. Avoid exact JOKE/SOURCE values present there; the publication gate will also reject collisions with older valid entries not sent to the model.
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
7. If the first idea cannot be retrieved and verified, discard it and choose another topic. For a timeless fallback, use the first URL in `available_fallback_sources`, fetch that exact URL using step 5, and write a fact supported by it. The ordered pool is shown below for meaning only; do not choose an entry absent from the context list. If the list is empty or the selected page cannot be retrieved, call `noop` and do not request publication.
   1. `https://git-scm.com/docs/git-fsck`
   2. `https://git-scm.com/docs/git-clean`
   3. `https://git-scm.com/docs/git-stash`
   4. `https://git-scm.com/docs/git-commit-graph`
   5. `https://git-scm.com/docs/git-maintenance`
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
   - If generation still fails this gate, use the first exact text in `available_fallback_jokes` whose stated pun pair was not used in `recent_entries`. This ordered fallback pool is deterministic; do not rewrite its selected entry or choose an entry absent from the context list:
     1. `ルート権限を取ったら、帰りのルートも決まった。` (`ルート`: root / route)
     2. `ポートを開けたら、ボートが通った。` (`ポート` / `ボート`: port / boat)
     3. `キューが詰まって、急に困った。` (`キュー` / `急に`: queue / suddenly)
     4. `パッチを当てたら、ぱちっと直った。` (`パッチ` / `ぱちっと`: patch / snapping sound)
     5. `マージを待つ間、まあじっとしていよう。` (`マージ` / `まあじっと`: merge / stay still)
10. Perform the final self-check below. If any check fails, repair the body before calling a safe output. Never publish a body containing `redacted`, parentheses around the source, a homepage URL, or a source you did not successfully fetch.
11. Use the `publish_daily_dev_byte` safe-output tool exactly once with the body in the exact format below. Do not add any text before `FORMAT` or after `END`. The safe-output job independently rechecks Issue #1's label, the seven-line contract, the Asia/Tokyo date, and exact FACT/JOKE/SOURCE collisions against every valid existing entry before it posts.
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

Before `publish_daily_dev_byte`, verify all of the following:

- Line 1 equals `FORMAT: DAILY_DEV_BYTE_V1`.
- Line 7 equals `END: DAILY_DEV_BYTE_V1`.
- There are exactly seven non-empty lines in the order shown.
- `DATE` is the publication date in Asia/Tokyo.
- `CATEGORY` exactly matches one allowed category.
- `FACT` is 100-200 Unicode characters.
- `JOKE` is present on one separate line.
- The internal `JOKE` pun pair can be named as two identical or clearly similar Japanese sounds with different meanings, and the pair and exact text do not repeat `recent_entries`. If it cannot be named, reject and regenerate the joke; if generation still fails, select from `available_fallback_jokes` in order.
- `SOURCE` is byte-for-byte the exact URL passed to the successful `web_fetch` or `curl` call, starts with one allowed HTTPS prefix above, has a path after the host, and contains neither `redacted` nor parentheses.
- `SOURCE` is absent from `recent_entries`, or was selected from `available_fallback_sources`.
- The subject is not duplicated in `recent_entries`.

If any item is false and cannot be repaired, use `noop` instead of publishing.

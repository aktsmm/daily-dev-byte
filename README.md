# Daily Dev Byte

毎日ひとつ、検証済みのIT小ネタと、同じ／近い音を別の意味で掛ける日本語の音声的なダジャレを届ける GitHub Agentic Workflows のデモです。

**Public Preview:** GitHub Agentic Workflows は Public Preview の機能です。仕様や利用条件が変更される可能性があります。

## デモ

- GitHub Pages: https://aktsmm.github.io/daily-dev-byte/
- フィードIssue: https://github.com/aktsmm/daily-dev-byte/issues/1
- Actions: https://github.com/aktsmm/daily-dev-byte/actions/workflows/daily-dev-byte.lock.yml

## アーキテクチャ

1. `.github/workflows/daily-dev-byte.md` が毎日 08:00（Asia/Tokyo）または手動実行で起動します。
2. Copilot が Issue #1 の全履歴（全ページ）を読んで重複を避け（取得が不完全なら配信せず `noop`）、一次・公式情報を `web-fetch` で検証します。実行環境に組み込み `web_fetch` が公開されない場合だけ、同じ許可ドメイン内で `curl` にフォールバックします。
3. `safe-outputs.add-comment` が `daily-byte-feed` ラベル付きの Issue #1 に、厳格な7行の機械可読形式で最大1件だけ投稿します。エージェント本体には書き込み権限を与えません。
4. Issue #1 が追記型の永続的な正本（source of truth）です。公開後、`publish-daily-dev-byte-archive.yml` が Issue #1 のコメントを読み、`github-actions[bot]`による投稿だけを対象に、gh-awの自動workflow markerまたは可視の`FORMAT: DAILY_DEV_BYTE_V1`で生成コメントを識別します。
5. アーカイブ更新ジョブは各コメントを`END: DAILY_DEV_BYTE_V1`まで個別に検証し、有効な投稿をコメント公開時刻の新しい順に`docs/archive.json`へ書き出します。最新の1件を「最新のDev Byte」、残りを「これまでのByte」としてPagesに表示します。新しい投稿が壊れていても、過去の有効な履歴は失われません。

ブラウザー側は同一オリジンの `archive.json` だけを取得し、GitHub REST APIを呼びません。JSONは表示前に形式・URL・時系列を再検証し、取得不能または不正な場合はIssue #1への導線を含む明確なエラーを表示します。取得した文字列は `textContent` で描画し、コメント内のHTMLをそのままDOMへ挿入しません。アーカイブは最初の6件だけを表示し、「もっと見る／閉じる」で段階的に閲覧できます。

### 公開コメント形式

```text
FORMAT: DAILY_DEV_BYTE_V1
DATE: YYYY-MM-DD
CATEGORY: 許可されたカテゴリ
FACT: 100-200文字の日本語IT小ネタ
JOKE: 1行の日本語おやじギャグ（同音・類音を別義で掛けるダジャレ）
SOURCE: 許可された公式ドメインの直接HTTPS URL
END: DAILY_DEV_BYTE_V1
```

この後ろにgh-awが監査用workflow markerを自動付与します。旧HTML comment marker形式も読み取り互換性のため解析できます。

## セットアップ

### Copilot認証

このリポジトリは `permissions: copilot-requests: write` と Actions 組み込みの `GITHUB_TOKEN` で Copilot 推論を認証します。PATもシークレットも不要です。個人所有リポジトリでは利用分がリポジトリ所有者の Copilot シートに課金されます（組織所有リポジトリでは組織に直接課金）。

```yaml
permissions:
  issues: read
  copilot-requests: write
```

トークンは実行ごとに発行・失効するため、有効期限切れによる定期実行の停止が起こりません。

参照:

- <https://docs.github.com/en/copilot/concepts/agents/copilot-cli/copilot-cli-in-github-actions>
- <https://github.github.com/gh-aw/reference/auth/>

前提として、リポジトリ所有者に有効な Copilot シートが必要です。シートが無効な場合はモデル一覧の取得に失敗し、`agent` ジョブが停止します。

#### フォールバック: PAT方式

`copilot-requests: write` が使えない場合のみ、Copilot Requests の読み取り権限を持つ fine-grained PAT を `COPILOT_GITHUB_TOKEN` に登録します。PATの Resource owner は個人アカウントを選択してください。

```powershell
gh aw secrets set COPILOT_GITHUB_TOKEN --value "<fine-grained PAT>"
```

トークン値をファイル、Issue、ログへ保存しないでください。`copilot-requests: write` が設定されている間、このシークレットは推論には使われません（併用しても無視されます）。PATには有効期限があるため、期限切れで定期実行が止まる点に注意してください。

### ワークフローのコンパイル

```powershell
gh extension install github/gh-aw
gh aw compile daily-dev-byte --strict --validate
```

編集対象は `.github/workflows/daily-dev-byte.md` です。生成された `.github/workflows/daily-dev-byte.lock.yml` もコミットします。

#### `Blocked compile-agentic version` で起動できない場合

2026-09-22 の実行では、生成済みワークフローのコンパイラー `v0.82.9` が公式の実行禁止リストに入り、`activation` の `Check compile-agentic version` で停止しました。記事生成・投稿処理は実行されていません。復旧用の生成バージョンは `v0.88.8` です。

既にインストール済みの場合は、CLI を更新してから再コンパイルします。CLI だけの更新や、生成ファイル内のバージョン番号だけの書き換えでは復旧しません。

```powershell
gh extension upgrade gh-aw
gh aw version
gh aw compile daily-dev-byte --strict --validate
node --test tests/workflow.test.js
```

生成された `.github/workflows/daily-dev-byte.lock.yml`、`.github/aw/actions-lock.json`、コンパイラーが更新した `.gitattributes` を確認してコミットし、`main` に反映してください。その後、下記の手動実行で新しい実行を開始します。失敗した古い実行の再実行では、古いコミットの生成ファイルが使われます。バージョンチェックは削除・無効化しないでください。

禁止リストは更新されるため、将来の互換性まで固定バージョンで保証されるわけではありません。再発時も[公式の互換性設定](https://github.com/github/gh-aw-actions/blob/main/.github/aw/compat.json)と[リリース](https://github.com/github/gh-aw/releases/latest)を確認して更新・再生成します。

### GitHub Pages

Pages の公開元を `main` ブランチの `/docs` に設定します。

```powershell
gh api --method POST repos/aktsmm/daily-dev-byte/pages `
  -f source[branch]=main `
  -f source[path]=/docs
```

## 手動実行と確認

```powershell
gh workflow run daily-dev-byte.lock.yml --repo aktsmm/daily-dev-byte --ref main
gh run list --repo aktsmm/daily-dev-byte --workflow daily-dev-byte.lock.yml --limit 1
```

実行完了後、Issue #1 に新しいコメントが追加され、Pages の最新カードと永続アーカイブへ反映されることを確認します。GitHub Actions のスケジュール実行は高負荷時に遅延することがあり、指定時刻ちょうどの開始は保証されません。

## 自動復旧と再発防止

AI を使わない補助ワークフローが、配信の停止と重複を検知・復旧します。

| 仕組み | ファイル | 動作 |
| --- | --- | --- |
| watchdog | `.github/workflows/watchdog.yml` | 1日2回、約25時間成功がなければ配信を起動。30分以上止まった実行はキャンセル |
| heal-on-failure | `.github/workflows/heal-on-failure.yml` | 失敗ログに `tool denial` があれば**セーフモード**（`safe_mode=true`、シェル不使用）で再実行。それ以外は1回だけ再実行。再実行も尽きたらアラート Issue を1件作成 |
| アーカイブ保険 | `publish-daily-dev-byte-archive.yml` | 配信完了後に加え、1日3回の定期実行でも `archive.json` を再同期 |
| 重複検知 | `.github/scripts/check-duplicates.js` | 公開後に最新の投稿を過去の全件と比較し、事実の文章またはダジャレが近ければ Issue を作成（事後通知。投稿自体は止めない） |
| CI | `.github/workflows/ci.yml` | PR / main への push でテストを実行（配色の WCAG AA コントラスト、許可シェルコマンドとプロンプトの整合も検査） |

### 障害時の確認手順

1. `gh run list --workflow daily-dev-byte.lock.yml --limit 5` で状態を確認します。
2. 「tool denial」で失敗した場合は、セーフモードで再実行されます。手動なら `gh workflow run daily-dev-byte.lock.yml -f safe_mode=true` です。恒久的に直すには、拒否されたコマンドを `daily-dev-byte.md` の `bash:` 許可リストへ追加し、`gh aw compile daily-dev-byte` で lock を再生成し、`tests/workflow.test.js` を更新します。
3. 配信は成功したのにアーカイブが古い場合は、`gh workflow run publish-daily-dev-byte-archive.yml` を実行します。
4. 「repeated a subject or joke」の Issue が出たら、履歴取得が不完全でなかったか確認し、必要なら該当コメントを調査します。確認後に Issue を閉じます。
## 運用上の注意

- **情報源:** 原則として公式ドキュメント、公式ブログ、標準仕様などの一次情報を使います。主張を確認できない場合は公開せず、別の題材へ切り替えます。
- **コスト:** Agentic Workflow は Actions 実行時間とAI creditsを消費します。ワークフローは1回 `1000` AI credits、24時間で `2000` AI creditsを上限としています。
- **公開アーカイブ:** Pagesは同一オリジンの`docs/archive.json`を使います。GitHub APIのブラウザー実行時レート制限の影響は受けません。
- **キャッシュ:** Pages/CDNのキャッシュにより、アーカイブ更新後に新しい投稿が表示されるまで短い遅延が生じる場合があります。

## ローカル確認

```powershell
node --check docs/app.js
node --test tests/*.test.js
python -m http.server 8000 --directory docs
```

ブラウザーで http://localhost:8000/ を開きます。

## ライセンス

[MIT](LICENSE)

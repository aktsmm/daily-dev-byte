# Daily Dev Byte

毎日ひとつ、検証済みのIT小ネタとおやじギャグを届ける GitHub Agentic Workflows のデモです。

**Public Preview:** GitHub Agentic Workflows は Public Preview の機能です。仕様や利用条件が変更される可能性があります。

## デモ

- GitHub Pages: https://aktsmm.github.io/daily-dev-byte/
- フィードIssue: https://github.com/aktsmm/daily-dev-byte/issues/1
- Actions: https://github.com/aktsmm/daily-dev-byte/actions/workflows/daily-dev-byte.lock.yml

## アーキテクチャ

1. `.github/workflows/daily-dev-byte.md` が毎日 08:00（Asia/Tokyo）または手動実行で起動します。
2. Copilot が Issue #1 の最近のコメントを確認して重複を避け、一次・公式情報を `web-fetch` で検証します。実行環境に組み込み `web_fetch` が公開されない場合だけ、同じ許可ドメイン内で `curl` にフォールバックします。
3. `safe-outputs.add-comment` が `daily-byte-feed` ラベル付きの Issue #1 に、厳格な7行の機械可読形式で最大1件だけ投稿します。エージェント本体には書き込み権限を与えません。
4. `docs/app.js` が公開 GitHub REST API からコメントを新しい順に取得します。gh-awの自動workflow markerで生成コメントを識別し、`FORMAT: DAILY_DEV_BYTE_V1` から `END: DAILY_DEV_BYTE_V1` までを検証して、最新の有効な投稿を表示します。新しい投稿が壊れていても、過去の有効な投稿へ復旧します。

ブラウザー側は依存関係やビルド工程がなく、取得した文字列を `textContent` で描画します。コメント内のHTMLをそのままDOMへ挿入しません。

### 公開コメント形式

```text
FORMAT: DAILY_DEV_BYTE_V1
DATE: YYYY-MM-DD
CATEGORY: 許可されたカテゴリ
FACT: 100-200文字の日本語IT小ネタ
JOKE: 1行の日本語おやじギャグ
SOURCE: 許可された公式ドメインの直接HTTPS URL
END: DAILY_DEV_BYTE_V1
```

この後ろにgh-awが監査用workflow markerを自動付与します。旧HTML comment marker形式も読み取り互換性のため解析できます。

## セットアップ

### Copilot認証

個人リポジトリでは、Copilot Requests の読み取り権限を持つ fine-grained PAT を Actions のリポジトリシークレット `COPILOT_GITHUB_TOKEN` に登録します。PATの Resource owner は個人アカウントを選択してください。

```powershell
gh aw secrets set COPILOT_GITHUB_TOKEN --value "<fine-grained PAT>"
```

トークン値をファイル、Issue、ログへ保存しないでください。組織リポジトリで集中課金を使える場合は `copilot-requests: write` 方式もありますが、このデモは個人リポジトリ向けシークレット方式です。

### ワークフローのコンパイル

```powershell
gh extension install github/gh-aw
gh aw compile daily-dev-byte --strict --validate
```

編集対象は `.github/workflows/daily-dev-byte.md` です。生成された `.github/workflows/daily-dev-byte.lock.yml` もコミットします。

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

実行完了後、Issue #1 に新しいコメントが追加され、Pages のカードへ反映されることを確認します。GitHub Actions のスケジュール実行は高負荷時に遅延することがあり、指定時刻ちょうどの開始は保証されません。

## 運用上の注意

- **情報源:** 原則として公式ドキュメント、公式ブログ、標準仕様などの一次情報を使います。主張を確認できない場合は公開せず、別の題材へ切り替えます。
- **コスト:** Agentic Workflow は Actions 実行時間とAI creditsを消費します。ワークフローは1回 `1000` AI credits、24時間で `2000` AI creditsを上限としています。
- **公開API:** Pages は未認証の GitHub REST API を使います。通常の未認証リクエストは1時間あたり60回が目安です。上限到達時はページにレート制限エラーを表示します。
- **キャッシュ:** GitHub APIやPages/CDNのキャッシュにより、新しい投稿の表示まで短い遅延が生じる場合があります。

## ローカル確認

```powershell
node --check docs/app.js
node --test tests/*.test.js
python -m http.server 8000 --directory docs
```

ブラウザーで http://localhost:8000/ を開きます。

## ライセンス

[MIT](LICENSE)

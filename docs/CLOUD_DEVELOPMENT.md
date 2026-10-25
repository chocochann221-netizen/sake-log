# クラウド開発環境

Node.js 24以上、Chromium、Wrangler 4.45.0、Playwright 1.62.1を使用する。
アプリ本体は静的HTML/JSとCloudflare Pagesの `_worker.js`。フロントエンドの依存インストール・ビルドは不要。
開発ツールはチェックアウト外の `/workspace/sake-log-tools` に置く。

環境はタスクごとに隔離される。既存の `/workspace/sake-log` を使い、明示的な依頼なしにGit worktreeを作らない。
`docs/ai/TEAM_RULES.md`、Decision Log、Release Gateを読んでから作業する。

## 再導入

環境設定に保存した `install_script`、または保持された次のスクリプトを実行する。
自分が起動したWranglerを止めてから依存を更新する。

```sh
bash /workspace/sake-log-tools/install.sh
```

ロックファイルがあれば `npm ci` を使う。初回は次の正確なバージョンをチェックアウト外に導入する。

```sh
npm install --prefix /workspace/sake-log-tools --cache /workspace/.npm-cache --save-exact wrangler@4.45.0 typescript@5.9.3 playwright@1.62.1
```

## 起動と検証

```sh
cd /workspace/sake-log-tools
XDG_CONFIG_HOME=/workspace/sake-log-tools/config XDG_CACHE_HOME=/workspace/sake-log-tools/cache WRANGLER_SEND_METRICS=false /workspace/sake-log-tools/node_modules/.bin/wrangler pages dev /workspace/sake-log --ip 127.0.0.1 --port 8788 --compatibility-date=2025-10-08 --persist-to /workspace/sake-log-tools/state
```

長時間動作する実行セッションで起動する。環境スナップショットにプロセスは保持されない。
WranglerのRequest.cf取得警告は、ローカルの代替値を使用して起動できることを確認済み。
localhostの利用者向けプレビューリンクは作らない。

別セッションで実行する。

```sh
cd /workspace/sake-log
NODE_PATH=/workspace/sake-log-tools/node_modules node --test tests/*.test.mjs
```

- `frontend.test.mjs`: 実Chromium・模擬Supabase API。セッション、保存、削除、復旧、認証導線、320〜412px表示。
- `edge-security.test.mjs`: 実際のEdge FunctionソースをNode上で実行し、Supabase/LINE/Storageを模擬して所有権・失敗・競合を確認。
- `syntax-and-worker.test.mjs`: JS/HTML/TS構文、起動したWorkerへの実HTTP、認証なし拒否、Service WorkerのAPI非キャッシュ。

NodeのTypeScript除去APIの警告はテスト失敗ではない。Deno本番環境での型検査・実通信を代替するものではない。
`TEST_BASE_URL` と `CHROMIUM_PATH` でテスト接続先・ブラウザのパスを変更できる。
テストは本番アカウントを作成せず、実在利用者のデータを書き換えない。

## 外部接続と公開の境界

`mtshsijgfmottgkbgnir.supabase.co` と `muro.sakenowa.com` を環境設定の許可ドメインに追加するドラフトを保存済み。
ドラフト保存だけでは実行環境へ適用・公開されない。設定を確認・保存し、環境を公開してから実通信を再確認する。

ローカルの未認証経路・模擬APIテストにはsecret不要。本番認証、A/Bテスト、AI認識、Edge Function配備には別途認可済みの接続・アカウントが必要。
キー値をチャットやGitへ書かない。`OPENAI_API_KEY` はCloudflare Worker側の設定であり、このクラウド環境の予約名へ無理に登録しない。

完全なSupabase schema/policyの再構築ファイルやAndroidネイティブプロジェクトはこのリポジトリにない。
本番DBの変更、Edge Function配備、mainへのマージは起動処理に含めない。

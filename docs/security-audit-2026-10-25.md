# 公開前コード監査・修正結果

更新: 2026-10-26 JST。監査開始時のmain: `d220fa84ee4bf0a691a22c965f783eabbb41bc93`。
作業ブランチ: `audit/pre-release-2026-10-25`。
対象はWeb/PWAのAndroid先行公開。Apple・イベント機能は既存GateどおりDeferred。

## 結論

**公開判定はHOLD。** 以下のコード修正・ローカル検証を完了したが、本番のA/B所有権試験、OAuth実復帰、Android実機UATを通過したとは扱わない。
既存Gateの完了チェックやDecision Logを変更していない。本番DB、RLS、RPC、FK index、SMTP、料金仕様も変更していない。
コード上の再現と本番での悪用成立・侵害事実は別であり、侵害が起きたという証拠は取得していない。

## P0として扱った問題

| ID | 発見内容と根拠 | 対応 |
|---|---|---|
| S01 | 開示/退会がユーザー所有DB行のStorageパスをそのままservice roleで読み取り/削除。パスが他人のものでも関数内では拒否しない。本番でそのような行を作れるかは現行DB制約の実通信確認待ち | 全パスをユーザー先頭フォルダと照合し、別所有者・パストラバーサル・エンコードした区切りを拒否。開示/退会の模擬実行で他人Storageへの要求0件を検証 |
| S02 | LINE連携callbackは署名付きstate内のuserIdだけでmappingを変更。callbackの利用者が連携開始アカウント本人かを確認しない。lookup後のupsertには所有者を上書きする競合もある | GET callbackでmappingを書かず、同一ユーザーの認証済みPOSTで完了。upsertをinsertへ置換。別ユーザーの完了要求はトークン交換前に403 |
| S03 | ログアウト後のrefresh応答が旧セッションを復活させ、履歴・開示状態・画面・写真キャッシュも残る | セッション世代、要求中断、応答後再確認、私的UIとBlob破棄、ユーザー別draft/pending、キャッシュ所有者照合。遅延応答とユーザー切替試験を追加 |

## P1と修正

- **退会仕様の不一致:** APIは `confirmation: DELETE_MY_ACCOUNT`、画面は旧 `confirm_email`。指定済みのprovider-neutral方式に統一し、メールを持たないユーザーと二重送信を確認。
- **メール確認導線の欠落:** 確認メール画面、再送、60秒待機、アドレス変更、確認後ログインを実装。再送待機はクライアントUXでありサーバーのrate limitの代用ではない。
- **OAuthの不完全なPKCE:** verifierを生成せず別キーを全検索する旧経路を廃止。Google開始時にS256 challengeを生成し、開始タブのverifierで交換。成功・失敗のURLからcode/tokenを除去。LINEログインは開始タブのchallengeと照合。
- **refresh競合/無限再試行:** 同時更新を1要求にまとめ、ユーザー確認の再試行を1回へ制限。通信障害だけで認証情報を消さず、再認証できない401時は画面へ戻す。
- **通信断時の復旧情報消失:** 照合失敗時にもfinallyでpendingを消す経路と、insert応答不明時にrequest IDを作り直す経路を修正。同じIDで確認・再試行できる。
- **削除失敗の成功表示:** RPC失敗がキューに残っている場合は削除成功と表示しない。0行UPDATEも成功にしない。
- **退会時の残存画像:** DB行のページングに加え、本人Storageフォルダの孤立画像と開示ZIPも収集し、認証ユーザー削除前に削除。途中失敗時は認証ユーザーを残し、部分削除の可能性を表示する。DBとStorageの完全な原子性を保証するものではない。
- **開示の切り捨て/競合:** APIの件数上限で終了しないページング、期限切れ後の再申請、cancel/readyの条件付き更新、キャンセル競合時のZIP削除、期限切れdownload時の実体削除を追加。
- **開示ファイルの安全性:** 他人パス拒否、CSV数式無害化、ダウンロード前/途中のサイズ上限。JSONの元データは改変しない。
- **内部情報の出力:** フロント・管理画面の生エラーログ、Workerの生AI応答・内部エラー返却を除去。WorkerのAPIパスをService Workerのキャッシュ対象から除外。

## P2・残件・旧コード

写真プレビューを交換・reset・logoutで解放し、Androidのメモリ残留を軽減した。

削除した旧経路: 退会のメール一致/confirm_email送信、localStorageの任意code-verifier探索、LINEの認証なしmapping確定とupsert、管理画面の未使用 `sakelog_access_token` fallback、生エラーログ。
旧トークンの削除処理は、既存端末の残留値を掃除するため保持。

保持したもの:

- `/.netlify/functions/*`: 名前は旧ホスティング由来だが、現行app.js/event-submit.htmlとWorkerが実際に使う正規経路。参照があるため削除していない。
- DeferredイベントのDB/関数/画面とmenu_scans: 既存Gateの明示的な残置方針と、実データの利用状況を取得できないため保持。権限は緩めていない。
- LINE generateLinkのhashed_token/action_link読取り: SDK応答の互換処理。不要と証明できず保持。
- 旧Netlify認証許可URL: Dashboardを確認できず、既存Gateが移行互換用に残置と記載。推測で削除しない。
- 24本のFK index、RLS、SECURITY DEFINER RPC: 現在の本番定義を取得できないため変更しない。

性能上の残件: 履歴の500件上限、写真の多数同時取得、巨大app.js、管理画面の重複処理はP2候補。件数仕様や大規模分割を無断で変えない。
DB/Storageを跨ぐ編集・退会の原子性、通信中断後の孤立ファイルの完全排除は、本番schemaと安全なテストfixtureで追加確認が必要。

## 実行したテストと結果

**36件 PASS / 0件 FAIL / 0件 SKIP**。再インストールと保存予定の起動コマンドでサーバーを再起動して再実行。
テスト名・実装は `tests/` を参照。

- 初期7件の回帰テストは修正前に7件ともFAILし、修正後はPASS。
- 実Chromium＋模擬API: セッション競合、logout後の遅延応答、pending保持、私的UI破棄、削除失敗、provider-neutral退会、メール確認、LINE callback拒否、bounded refresh、応答不明insert、二重保存、offline保持、0行更新、Blob解放、320/360/393/412px表示、通信障害後の再試行、PKCE code交換、ユーザー別draft/pending、遅延ログイン応答、アカウント切替後の自動保存。
- Edgeソース実行＋模擬サービス: Storage所有権、他人パス拒否、ページング、ストリーム上限、CSV、cancel競合、recent auth、退会失敗/ZIP/孤立画像、LINE同一ユーザー確認・hash化・state改ざん拒否。
- 実ローカルHTTP: 画面200、認識API GET=405、認証なしPOST=401。
- JS 21本、HTML内script 9本、TypeScript 4本の構文確認。Edge Function 3本のesbuild bundle成功。Deno本番型検査や配備済み関数の検証とは区別する。
- テキスト79ファイルの代表的secretパターン検査: 検出0。完全な秘密情報不存在の証明ではない。公開publishable keyはsecretと分類していない。
- `git diff --check` PASS。監査前の作業ツリーは変更なし。生成物・ツールはチェックアウト外に保持。

## 実通信・実機の制限

Supabase `/auth/v1/settings` の読取りを既存公開キーで試行したが、クラウドのCONNECTが403で拒否。接続先許可の不足であり、アプリの認証失敗やRLSのFAILとは分類しない。
環境にSupabase管理接続・A/Bテストユーザーのバインディングはなく、利用可能なSupabase管理ツールもない。
本番ユーザーの利用、架空認証情報の作成、課金API呼出しは行っていない。

外部接続が許可された後に必要な確認は次の3まとまり。

1. `SECURITY_AB_UAT.md` 正本のA/B双方向試験（profile/record/photo/Storage、RPC、role/plan、quota、server-only表）と終了時のテストデータ削除・残存確認。安全に用意した専用アカウントとfixtureで行う。
2. Supabase schema/policy/functionの読取り、Security/Performance Advisor、Google/LINE/メール実復帰・再ログイン・password recovery・退会・開示。新旧frontend/Edge Functionの互換性も配備前に確認する。
3. Android実機のカメラ/写真キャンセル、権限拒否、キーボード、戻る、回線切替・画面復帰、撮影から編集・削除までのCore Journey。

## Security Gate / 公開停止事項

既存Gate 1 WAIT、Gate 2 IN PROGRESS、Gate 3 WAITを維持。ローカル修正によって本番Security GateをPASSにはしない。
公開を止める項目は、上記修正のレビューと適切な配備、A/B実通信、認証実UAT、Android実機、既存Design Freeze/Owner確認。
特にLINEのfrontendとEdge Functionは同時に扱う必要がある。新frontendだけを先行配備すると旧Functionのcallbackを拒否する。既存ログイン中ユーザーへの移行手順を確認してから配備する。
Supabaseの管理アクセスなしに関数を配備したり、mainへマージして自動本番配備を起動したりしていない。

設計判断、料金、SMTP契約、DL変更は今回なし。大規模なデータモデル変更や全面的な認証方式変更が必要になった場合は別途承認対象とする。

## クラウド設定

`install_script` と `start_skill` をドラフト保存済み。Node/Chromium/開発ツール、起動ディレクトリ、HTTP readiness、テストコマンドを記載。
追加許可ドメインは `mtshsijgfmottgkbgnir.supabase.co` と `muro.sakenowa.com`。
設定の確認・保存と環境の公開は利用者側の操作。保存済みドラフトと実行環境への適用・公開・新規タスクでの復元検証を混同しない。

実装修正コミット:

- `951f672a675f5c39ae0dfff6b5973135d9f76647`: 認証境界・クライアント復旧・frontend回帰テスト。
- `ff1086e38981bc7b1dc054978580aa93478b8d06`: Storage所有権・退会/開示・Edge回帰テスト。
- `f95b27e953d2bd06f031d4ebb7d2dcd72a1ac7f8`: Worker/ログ/旧token fallback・syntax/HTTPテスト。

監査記録コミットのSHAとGitHubの読戻し結果は最終作業報告に記載する。

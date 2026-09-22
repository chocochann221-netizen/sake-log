# 和酒ログ Ver.1 Release Gate

最終更新: 2026-09-21  
対象: Webプレ公開 / Android Ver.1  
対象外（Deferred）: Appleログイン / iOS / イベント機能

## 完成の定義

以下3条件をすべて満たした画面・機能のみ「完成」と判定する。

1. Product Design Final が確定している
2. GitHub実装がFinal Designと一致している
3. 実機テストがPASSしている

Designのみ・実装のみでは「完成」としない。

判定: `[ ]`未確認 / `[x]`完了 / `WAIT`前工程待ち / `PASS`合格 / `FAIL`要修正 / `DEFERRED`Ver.1対象外

## Gate 1 — Product Design

担当: Product Design / 最終確認: Owner

- [ ] TOP / ホーム — Final版確定
- [ ] 初回利用導線 — 初回起動から本体導線まで確定
- [ ] ログイン / 登録 — Google・LINE・メールの画面と導線確定
- [ ] 撮影画面 — カメラ・表裏撮影導線確定
- [ ] 認識結果 / 候補選択 / 誤認識修正 — 候補なし・手動修正を含め確定
- [ ] 飲酒記録入力 — 必須・任意項目と入力UI確定
- [ ] 料理写真 / 思い出写真 — 撮影・削除・再撮影UI確定
- [ ] 誰と飲んだ — 任意入力UI確定
- [ ] 保存完了 / 記録詳細 — 保存後・編集導線確定
- [ ] マイ酒ログ — 一覧・詳細・編集・削除導線確定
- [ ] 知識の蔵 — Ver.1掲載範囲・導線確定
- [ ] マイページ / 設定 — 写真保存・ログアウト・退会等を確定
- [ ] エラー / 空状態 — 通信・認識・保存失敗・0件等を定義
- [ ] 権限拒否状態 — カメラ・位置情報拒否時の導線確定
- [ ] 利用規約 / プライバシーポリシー導線 — 最終配置確定
- [ ] 全画面整合性確認 — 木質世界観・余白・ボタン・文字等を統一
- [ ] Design Freeze — 全Ver.1画面をFinal指定し変更凍結

### Gate 1 完了条件
- [ ] Ver.1の全画面にProduct Design Finalが存在
- [ ] 未設計の遷移・状態なし
- [ ] Owner確認完了
- [ ] Design Freeze完了

**Gate 1 判定: WAIT**

## Gate 2 — Technical / Implementation

担当: Development / DB・Auth: Supabase / 最終確認: Development + Owner

### Security / Database
- [x] 主要テーブルRLS — 本人所有条件確認済み
- [x] クロスユーザー基本監査 — 他ユーザー主要データの操作を防止
- [x] 管理RPC anon遮断 — 対象RPC `anon_exec=false`
- [x] Ver.1 DeferredイベントRPC遮断 — イベント系SECURITY DEFINER全23本で `anon_exec=false` / `auth_exec=false`。DB・関数は将来再開用に残置
- [x] Service Role露出監査 — フロントエンドへの露出なし
- [x] 内部専用テーブル権限 — `brewery_links` / `line_account_links` はRLS維持＋anon/authenticatedの直接権限を撤回。service_roleのみ直接アクセス
- [x] SECURITY DEFINER最終監査 — 管理系・Deferredイベント系を遮断。本体6 RPCも個別監査済み：未使用3本遮断、`is_admin`をSECURITY INVOKER化、必要2本のみSECURITY DEFINER + authenticatedを意図的維持
- [x] pg_trgm警告対応 — `public` から `extensions` schemaへ移動済み。`extensions.similarity()` smoke test PASS、Security Advisor警告消滅
- [ ] 漏洩パスワード保護 — 採用決定。Supabase Auth設定で有効化が必要（現在の接続ツールではAuth設定変更APIなし）。有効化後Advisor再確認
- [x] Supabase Security Advisor再実行 — SECURITY DEFINER警告は46→25→6→2件。残る2件（AI認識quota / 本人記録削除）は用途・auth.uid()制約を確認し意図的維持。漏洩パスワード保護のみ設定待ち

### Authentication
- [x] LINE認証コード監査 — state署名・nonce・redirect制限確認済み
- [ ] 正式公開URL確定 — Ver.1正式URLを1つに確定
- [ ] Supabase Site URL / Redirect URLs — 正式URLへ設定
- [ ] Google OAuth本番設定 — 正式URL環境で認証可能
- [ ] LINE本番設定 — Callback・CORS・redirect整合
- [ ] メール認証本番設定 — 正式URLへ正常復帰
- [ ] 同一ユーザー再ログイン — 既存データへ正常復帰

### Reliability / Recovery
- [ ] オフライン処理 — 不正保存・データ破損なし
- [ ] 二重保存防止 — 重複レコードを生成しない
- [ ] 保存途中終了 / 下書き復元 — 安全に復帰・再操作可能
- [ ] 認識失敗処理 — 手動修正へ進める
- [ ] APIエラー処理 — 行き止まりにならない
- [ ] バックアップ確認
- [ ] 復元テスト — 実際に復元可能

### Product Design → Implementation
- [ ] Final Design反映 — Design Freeze後に実装
- [ ] 全画面1:1照合 — Finalと実装の差分ゼロ
- [ ] レスポンシブ確認 — Android主要サイズで破綻なし
- [ ] Release Candidate作成 — 技術側P0残件ゼロ

### Gate 2 完了条件
- [ ] Gate 1 PASS
- [ ] Product Design FinalとGitHub実装一致
- [ ] Security Advisor最終確認完了
- [ ] 認証本番設定完了
- [ ] P0技術課題ゼロ
- [ ] Web Release Candidate作成完了

**Gate 2 判定: IN PROGRESS**

## Gate 3 — Real Device / UAT

担当: Owner + Development / 主対象: Android / 環境: Release Candidate

### Authentication
- [ ] 新規登録
- [ ] Googleログイン / 再ログイン — 同一ユーザー・記録維持
- [ ] LINEログイン / 再ログイン — 同一ユーザー・記録維持
- [ ] メール登録 / ログアウト / 再ログイン

### Core Journey
- [ ] 表ラベル撮影
- [ ] 裏ラベル撮影
- [ ] ラベル認識
- [ ] 候補選択
- [ ] 誤認識修正
- [ ] 飲酒記録入力
- [ ] 料理写真
- [ ] 思い出写真
- [ ] 記録保存
- [ ] マイ酒ログ反映
- [ ] 記録詳細
- [ ] 記録編集
- [ ] 記録削除

### Failure / Recovery
- [ ] 通信OFF → 復旧
- [ ] 操作途中終了 → 復帰
- [ ] カメラ権限拒否
- [ ] 位置情報拒否
- [ ] 認識失敗 → 手動修正
- [ ] 二重タップ → 二重登録なし

### Device / Account
- [ ] 端末写真保存 ON
- [ ] 端末写真保存 OFF
- [ ] 設定変更反映
- [ ] Android画面表示 — 見切れ・重なり・操作不能なし
- [ ] ログアウト
- [ ] アカウント削除
- [ ] 削除後ログイン確認

### Final Smoke Test
新規ユーザー状態から以下を途中で開発操作を挟まず1回で完走する。

`起動 → 登録/ログイン → 撮影 → 認識 → 候補確認/修正 → 飲酒記録 → 保存 → マイ酒ログ → 詳細 → 編集 → 再表示 → ログアウト → 再ログイン`

- [ ] Core Journey完走
- [ ] データ欠損なし
- [ ] 二重登録なし
- [ ] UI崩れなし
- [ ] 致命的エラーなし
- [ ] P0 = 0
- [ ] 公開阻害P1 = 0

**Gate 3 判定: WAIT**

## Release Decision — Webプレ公開

- [ ] Gate 1 PASS
- [ ] Gate 2 PASS
- [ ] Gate 3 PASS
- [ ] P0 = 0
- [ ] 公開阻害P1 = 0
- [ ] 利用規約・プライバシーポリシー公開済み
- [ ] 本番URL・認証設定確認済み
- [ ] バックアップ / 復元確認済み

**Web Release判定: HOLD**

## Android Release

- [ ] Webプレ公開後の重大不具合なし
- [ ] 初期フィードバック確認
- [ ] 必要なP0/P1修正完了
- [ ] Android Release Candidate作成
- [ ] Android最終Smoke Test PASS
- [ ] Google Play提出物確認
- [ ] Google Play提出

**Android Release判定: HOLD**

## Deferred — Ver.1対象外

| 項目 | 判定 | 備考 |
|---|---|---|
| Appleログイン | DEFERRED | Apple Developer / 法人化方針確定後 |
| iOS版 | DEFERRED | Apple関連方針確定後 |
| イベント機能 | DEFERRED | DB・実装資産は保持。Ver.1では公開しない |
| イベント写真共有 | DEFERRED | イベント再開時 |
| 高度な分析 | DEFERRED | Future |
| 購入導線 | DEFERRED | 公開後の優先アップデート |
| アフィリエイト | DEFERRED | 公開後に実装 |

## Change Control

- 新機能は原則Ver.1 Release Gateへ追加しない
- 新しいアイデアはGitHub Issueへ保存
- P0/P1不具合のみ公開前に修正
- Product Design Finalを実装都合で変更しない
- Final変更が必要ならProduct Designへ戻して再確定
- 変更後は影響範囲の実機テストを再実施

## Current Overall Status

- Product Design Gate: WAIT
- Technical Gate: IN PROGRESS
- Real Device Gate: WAIT
- Web Release: HOLD
- Android Release: HOLD

クリティカルパス:

`Product Design完成 → Design Freeze → 実装1:1照合 → 技術残件完了 → Release Candidate → Android実機UAT → Webプレ公開 → Android公開`

# 和酒ログ Ver.1 バックアップ・復元 運用手順書

最終更新: 2026-09-25
対象: Sake-log / Supabase project `mtshsijgfmottgkbgnir`
目的: 利用者の酒ログと写真を、障害・誤操作・削除事故から復旧できる状態に保つ。

## 1. 基本方針

Ver.1は「DBの日次論理バックアップ + Supabase Storage写真の外部コピー」の二層構成とする。

- DB: 1日1回バックアップ。日次7世代 + 週次4世代を基本保持。
- Storage: 1日1回、Supabase外のオブジェクトストレージへ増分コピー。
- DBバックアップとStorage写真は別物として管理する。
- バックアップ資格情報はアプリ、公開リポジトリ、ブラウザへ置かない。
- 本番DBへの復元は、障害範囲・復元点・失われる更新を確認してから行う。
- 「バックアップが作成された」だけでなく、定期的に「復元できる」ことまで確認する。

## 2. 初回設定

### 2.1 DB

1. Supabase CLIをバックアップ実行環境に準備する。
2. 本番DB接続情報はSecretとして保存する。
3. `supabase db dump` による論理バックアップを取得する。
4. ファイル名にUTC日時を含める。
   - 例: `sakelog-db-20260923T000000Z.sql`
5. dumpをSupabaseとは別のバックアップ先へ転送する。
6. 保存先でファイルサイズが0でないことを確認する。
7. 日次7世代 + 週次4世代の保持ルールを設定する。

### 2.2 Storage

1. Supabase Storageのバックアップ対象bucketを確定する。
2. S3互換アクセス用のバックアップ専用資格情報を作る。
3. 資格情報はSecret管理し、GitHubへcommitしない。
4. 外部Object StorageにSake-log専用backup領域を作る。
5. Supabase Storage → 外部Storageの増分コピーを設定する。
6. 初回は全objectをコピーする。
7. コピー後にobject件数と総容量を記録する。
8. 可能ならバックアップ先でversioning / delete protectionを有効にする。

### 2.3 初回基準値

初回バックアップ時に以下を記録する。

- バックアップ日時
- DB dumpファイル名 / サイズ
- migration件数
- `profiles` 件数
- `drinking_records` 件数
- `sake_photos` 件数
- `recognition_results` 件数
- `corrections` 件数
- Storage object件数
- Storage総容量
- バックアップ先
- 実行結果 PASS / FAIL

## 3. 日次運用

日次ジョブ終了後、次を確認する。

- [ ] DB dump成功
- [ ] dumpサイズ > 0
- [ ] 外部バックアップ先への転送成功
- [ ] Storage増分コピー成功
- [ ] コピーエラー 0件
- [ ] 前日比が不自然でない
- [ ] 最新成功日時が24時間以内
- [ ] 保持世代がルールどおり
- [ ] Secret / credentialエラーなし

失敗時は成功扱いにしない。前日のバックアップが存在していても、その日のジョブ失敗を記録し再実行する。

## 4. 障害時の復旧

### 4.1 最初にすること

1. 障害発生時刻を記録する。
2. DB障害 / Storage障害 / アプリ障害 / 誤削除を切り分ける。
3. 必要ならアプリの書き込みを停止する。
4. 現在のDBが読める場合、復元操作前に現状dumpを取得する。
5. 復元候補日時以降に失われるデータを確認する。
6. 使用するバックアップを確定する。

### 4.2 DB復元

1. 可能な限り一時環境でbackupをrestoreして検証する。
2. restoreエラーがないことを確認する。
3. migration履歴を確認する。
4. 主要テーブル件数をバックアップ時の基準値と比較する。
5. RLS、RPC権限、Auth、Edge Functions、Storage policyを確認する。
6. 本番restoreが必要な場合のみ、メンテナンス状態で実施する。
7. 復元後Smoke Testを行う。

Smoke Test:
- ログイン
- MY LOG一覧表示
- 記録詳細表示
- 新規1件保存
- 保存内容再読込
- 編集
- 削除
- 他ユーザーのデータが見えないこと

## 5. Storage写真の復旧と突合

DB restoreだけでは写真本体が復元されたことにならない。

### 5.1 突合

`sake_photos.storage_path` を基準に、外部backupのobjectと照合する。

確認するもの:
- DBにpathあり / Storageにもobjectあり → OK
- DBにpathあり / Storageにobjectなし → MISSING
- DBにpathなし / Storageにobjectあり → ORPHAN候補
- objectサイズ0 → ERROR

### 5.2 MISSING発生時

1. 外部backupの過去世代を検索する。
2. 該当objectがあればSupabase Storageへ戻す。
3. 元のstorage_pathを維持する。
4. アプリから画像表示を確認する。
5. 復元日時・対象object・原因を記録する。

### 5.3 ORPHAN

即削除しない。
DB削除とStorage削除のタイミング差、rollback、過去backup由来の可能性を確認し、保留期間後に削除判断する。

## 6. 復旧完了判定

以下がすべてPASSして初めて復旧完了とする。

- [ ] DB restore成功
- [ ] migration整合
- [ ] 主要テーブル件数整合
- [ ] RLS正常
- [ ] 必要RPC正常
- [ ] Auth正常
- [ ] MY LOG表示正常
- [ ] 新規保存正常
- [ ] 編集・削除正常
- [ ] Storage写真表示正常
- [ ] DB path / Storage object突合完了
- [ ] クロスユーザー漏洩なし
- [ ] 障害・復旧記録保存

## 7. 公開前チェック

### 必須
- [ ] 初回DB dump取得済み
- [ ] dumpをSupabase外へ保存済み
- [ ] 初回Storage全量コピー済み
- [ ] DB / Storage基準値記録済み
- [ ] 日次自動処理が連続2回以上成功
- [ ] 保持ルール確認
- [ ] SecretがGitHub / frontendに存在しない
- [ ] 一時環境でDB restore成功
- [ ] restore後Smoke Test PASS
- [ ] Storageからテスト写真を復元できる
- [ ] `sake_photos.storage_path` とobject突合PASS
- [ ] 障害時Runbookを参照できる
- [ ] RELEASE_GATE.mdの「バックアップ確認」「復元テスト」をPASSへ更新

## 8. 公開後の見直し

月1回:
- restore可能性をサンプル確認
- Storage MISSING / ORPHAN監査
- backup容量と保持期間確認
- 失敗履歴確認

利用者・記録件数が増え、24時間分のデータ損失を許容できなくなった時点で、Supabase Proの日次backupやPITRを再評価する。

## 9. 復元演習実績

2026-09-25時点で、公開前の隔離復元演習を完了。

- PostgreSQL backup: GitHub Actions `Sake-log Backup #9` PASS。custom dumpをBackblaze B2へ保存し、実オブジェクトを確認。
- PostgreSQL restore: `Sake-log Restore Test #8` PASS。B2最新dumpを隔離PostgreSQL 17へ復元し、主要テーブル・件数・RLS・関数を検査。PASSレポート保存後、一時DBを破棄。
- Storage backup: `Sake-log Storage Backup #1/#2` PASS。Supabase Storage `sake-photos` をB2へコピーし、object件数と総容量を照合。
- Storage restore: `Sake-log Storage Restore Test #1` PASS。最新PASSバックアップを隔離GitHub Runnerへ復元し、件数・総容量一致および0byte objectなしを確認。検証後に隔離領域を削除。
- 復元演習では本番DB・本番Storageへの書き戻しを行っていない。

この実績により、RELEASE_GATEの「バックアップ確認」「復元テスト」はPASS扱いとする。なお、日次自動化・保持世代運用・本番障害時の実復旧は別の運用項目として継続管理する。

## 10. インシデント記録テンプレート

- 発生日:
- 検知日時:
- 影響範囲:
- 原因:
- 書き込み停止日時:
- 採用backup:
- DB restore開始 / 完了:
- Storage復旧対象:
- MISSING件数:
- ORPHAN件数:
- Smoke Test:
- サービス再開日時:
- 再発防止:
- 担当:

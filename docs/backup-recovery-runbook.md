# 和酒ログ Ver.1 Backup / Recovery Runbook

最終更新: 2026-09-23
対象: Supabase project `mtshsijgfmottgkbgnir`

## 方針
- DB schema変更はSupabase migrationで管理し、GitHubをアプリコード・復旧手順の正本とする。
- 公開前に Dashboard > Database > Backups で利用可能なバックアップ方式と最新復元点を目視確認する。
- Supabase Storageの実ファイルはDBバックアップに含まれないため、DB復元とStorage復旧を別物として扱う。

## 公開前バックアップ確認
1. Dashboard > Database > Backups を開く。
2. 最新バックアップ/復元点と保持期間を記録する。
3. Free planなら自動日次バックアップを前提にせず、Supabase CLI `db dump` で論理バックアップを外部保管する。
4. Pro/Team/Enterpriseなら日次バックアップの存在を確認する。PITRは必要性と費用を別途判断する。
5. Storage `sake-photos` はDB backupだけでは写真本体が戻らないことを運用上明記する。

## DB復旧手順
1. 障害発生時刻・影響範囲を確定し、書き込みを止める。
2. 可能なら復旧前の現状DBをdumpして保全する。
3. Backupsから障害発生前の最も近い復元点を選ぶ。
4. 復元中はアプリをメンテナンス扱いにする。
5. 復元後、migration履歴と主要テーブル件数を確認する。
6. RLS / RPC権限 / Auth / Edge Functions / Storage policyを確認する。
7. テストユーザーで ログイン → MY LOG → 詳細 → 新規1件保存 → 削除 をSmoke Testする。
8. `sake_photos.storage_path` とStorage objectの整合を確認する。
9. 問題がなければ書き込みを再開する。

## アプリ側Recovery
- オフライン中は保存処理を開始せず、入力は端末draftへ保持。
- `drinking_records(user_id, client_request_id)` UNIQUE制約で同一保存要求の二重作成を防止。
- 保存ボタン連打はbusy flag + disabledで防止。
- 保存途中はrequest IDをlocalStorageへ記録し、再起動/再接続時にサーバー側を照合。
- 保存途中で失敗したレコードはrollback queueで削除を再試行。
- 入力draftは7日以内なら同一ユーザーだけ復元可能。写真Blobは自動復元せず再選択を案内。

## Release Gate
アプリ/DB上のReliability対策は監査済み。
バックアップはDashboard上の実バックアップ存在確認と公開前の復元演習が完了するまでPASSにしない。

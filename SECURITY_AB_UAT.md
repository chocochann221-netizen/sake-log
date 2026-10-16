# Security Gate — A/B Cross-User UAT

最終更新: 2026-10-17

目的: 実ユーザーを使わず、テスト専用A/BアカウントでBOLA/IDOR（他人データ横断）を実通信で確認する。

## 前提
- A/Bはテスト専用アカウント。
- 本番の既存ユーザーは使用しない。
- Bでテスト用の飲酒記録1件と酒写真1枚を作る。
- BのUUID / drinking_record.id / Storage pathだけをテスト材料として控える。
- テスト後はA/Bを退会し、Storage/DB残存も確認する。
- service_role/secret keyはブラウザ・端末・テストスクリプトへ絶対に渡さない。

## Aとして実施
1. Bのprofile UUIDを指定してSELECT → 0件であること。
2. Bのdrinking_record.idを指定してSELECT → 0件。
3. 同recordをUPDATE → 0件/拒否。所有者変更も拒否。
4. 同recordをDELETE → 0件/拒否。
5. Bのsake_photos行をSELECT/UPDATE/DELETE → 0件/拒否。
6. BのStorage pathを直接download → 拒否。
7. BのStorage pathへoverwrite/upsert → 拒否。
8. BのStorage folderへ新規upload → 拒否。
9. delete_my_drinking_record(B record_id) → 他人所有として失敗。
10. profiles.role / profiles.planを自分自身でUPDATE → 拒否。
11. ai_recognition_limitsを書換え → 拒否。
12. brewery_contact_private / brewery_links / line_account_linksをSELECT → 拒否。
13. event共有機能はVer.1 Deferred。通常個人データ試験とは分離する。

## Bとして逆方向
A/Bを入れ替えて1〜12を再実施する。

## PASS条件
- 他人の個人データ取得件数 = 0
- 他人の行更新/削除 = 0
- 他人Storage read/write = 全拒否
- role/plan自己昇格 = 拒否
- 内部専用表 = 拒否
- SECURITY DEFINER RPCで所有権迂回不可
- テスト後の退会でDB行・対象Storageが残らない

1項目でも成功した場合はSecurity Gate FAIL、公開停止（P0）。

## 現在の静的監査
2026-10-17時点:
- 主要個人テーブルRLSはauth.uid()所有者条件を再読込済み。
- UPDATE対象は所有者WITH CHECKあり。
- sake-photos StorageはUUID先頭フォルダ所有者のみCRUD。
- 3 Storage bucketsはprivate。
- public schema CREATEはanon/authenticatedとも不可。
- role/plan自己昇格経路は修正済み。
- ai_recognition_limitsはauthenticated SELECTのみ、書換え不可。
- server-only 3表はanon/authenticated直接権限なし。
- Security Advisor新規重大警告なし。

最終PASSは上記A/B実通信UAT完了後に付与する。

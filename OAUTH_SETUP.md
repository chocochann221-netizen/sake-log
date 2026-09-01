# 和酒ログ OAuth 設定メモ

最終更新: 2026-09-01

Supabase project: mtshsijgfmottgkbgnir

## 現在の本番URL
https://sake-log-git.pages.dev/

LINE Edge Function の許可URL・CORSもこのURLに合わせて設定済み。

## 共通コールバックURL
https://mtshsijgfmottgkbgnir.supabase.co/auth/v1/callback

Google / Apple のOAuthプロバイダ側には上記URLを登録する。

## 和酒ログ側の戻り先
アプリ側はログイン開始時に現在の公開URLを redirect_to として送る。

本番では:
https://sake-log-git.pages.dev/

Supabase:
Authentication > URL Configuration
- Site URL: https://sake-log-git.pages.dev/
- Redirect URLs: https://sake-log-git.pages.dev/ を許可

※ Site URL / Redirect URL は公開 settings API から取得できないため、公開前にSupabase Dashboardで目視確認する。

## Google
必要:
- Google Cloud OAuth Client ID
- Google Cloud OAuth Client Secret

Supabase:
Authentication > Providers > Google
- Enable Google
- Client ID
- Client Secret

Google Cloud:
- Application type: Web application
- Authorized redirect URI:
  https://mtshsijgfmottgkbgnir.supabase.co/auth/v1/callback

## Apple
必要:
- Apple Developer Team ID
- App ID
- Services ID
- Sign in with Apple Key
- Key ID
- Apple client secret

Apple Services ID の Return URL:
https://mtshsijgfmottgkbgnir.supabase.co/auth/v1/callback

Supabase:
Authentication > Providers > Apple
- Enable Apple
- Client IDs / Services ID
- Secret

注意:
AppleのWeb用client secretには有効期限があり、更新運用が必要。

## LINE
LINEはSupabase標準Social Providerではなく、専用Edge Functionで実装済み。

Edge Function:
- slug: line-login
- status: ACTIVE
- callback:
  https://mtshsijgfmottgkbgnir.supabase.co/functions/v1/line-login
- 許可済みアプリURL:
  https://sake-log-git.pages.dev/

必要なSupabase secrets:
- LINE_CHANNEL_ID
- LINE_CHANNEL_SECRET
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

LINE Developers側のCallback URL:
https://mtshsijgfmottgkbgnir.supabase.co/functions/v1/line-login

## 和酒ログ側
実装済み:
- Google / Apple はSupabase /auth/v1/settings を見て、有効な場合だけボタン表示
- LINEログインボタン
- OAuth redirect開始
- OAuth callbackのaccess_token / refresh_token受取
- PKCE code受取経路
- LINE token hash検証
- Supabase user取得
- セッション保存
- ホーム画面への復帰
- LINE既存アカウント連携
- 管理画面に「OAuth・本番URL診断」を追加

## 公開前テスト
各プロバイダごとに:
1. 新規登録
2. ログアウト
3. 再ログイン
4. 同一メールアドレス時のアカウント扱い確認
5. 記録作成
6. ログアウト後の再ログインで記録が残ること
7. アカウント削除
8. 再ログインできないこと

## 管理画面で確認
admin.html → 「🔐 OAuth・本番URL診断」

確認できるもの:
- 現在アクセスしているURLが本番URLか
- アプリの戻り先
- Google provider が有効か
- Apple provider が有効か
- LINE Edge Function が応答するか

Dashboardで別途目視するもの:
- Supabase Auth Site URL
- Supabase Redirect URLs
- Google Cloud Authorized redirect URI
- Apple Services ID Return URL
- LINE Developers Callback URL

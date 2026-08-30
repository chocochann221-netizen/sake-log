# 和酒ログ OAuth 設定メモ

Supabase project: mtshsijgfmottgkbgnir

## 共通コールバックURL
https://mtshsijgfmottgkbgnir.supabase.co/auth/v1/callback

OAuthプロバイダ側には上記URLを登録する。

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
LINEはSupabaseの標準Social Provider一覧にはないため、Custom OAuth/OIDC Providerとして接続する。

必要:
- LINE Developers Channel ID
- Channel Secret
- LINE Login OAuth/OIDC endpoints
- Supabase Custom OAuth/OIDC Provider設定

Callback URL:
https://mtshsijgfmottgkbgnir.supabase.co/auth/v1/callback

LINE設定完了後、Supabase /auth/v1/settings の external に有効プロバイダとして現れるprovider keyを、app.js の LINEボタン設定と一致させる。

## 和酒ログ側
実装済み:
- 有効なOAuthプロバイダだけログインボタンを表示
- Google / Apple / LINE ボタン枠
- OAuth redirect開始
- OAuth callbackのaccess_token / refresh_token受取
- Supabase user取得
- セッション保存
- ホーム画面への復帰

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

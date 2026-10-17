import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LINE_CHANNEL_ID = Deno.env.get("LINE_CHANNEL_ID")!;
const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET")!;
const CALLBACK_URL = SUPABASE_URL + "/functions/v1/line-login";
const ALLOWED_REDIRECTS = new Set([
  "https://sake-log-git.pages.dev/",
  "https://sake-log-git.pages.dev"
]);
const cors = {
  "Access-Control-Allow-Origin": "https://sake-log-git.pages.dev",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlText(s: string) { return b64url(enc.encode(s)); }

async function hmac(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}
async function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
async function makeState(payload: Record<string, unknown>) {
  const body = b64urlText(JSON.stringify({ ...payload, exp: Date.now() + 10 * 60_000 }));
  return body + "." + await hmac(body);
}
async function readState(state: string) {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig) throw new Error("invalid state");
  if (!(await safeEqual(await hmac(body), sig))) throw new Error("invalid state signature");
  const json = body.replace(/-/g, "+").replace(/_/g, "/");
  const padded = json + "=".repeat((4 - json.length % 4) % 4);
  const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), c => c.charCodeAt(0))));
  if (!payload?.redirectTo || !payload?.nonce || Date.now() > Number(payload.exp || 0)) throw new Error("expired state");
  if (!ALLOWED_REDIRECTS.has(payload.redirectTo)) throw new Error("redirect not allowed");
  return payload;
}
function redirect(location: string) {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
}
function appError(redirectTo: string, message: string) {
  const u = new URL(redirectTo);
  u.hash = "line_error=" + encodeURIComponent(message);
  return redirect(u.toString());
}
async function sha256Hex(s: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return Array.from(d).map(b => b.toString(16).padStart(2, "0")).join("");
}
async function buildLineAuthorizeUrl(redirectTo: string, mode: "login" | "link", userId?: string) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const state = await makeState({ redirectTo, nonce, mode, userId: userId || null });
  const auth = new URL("https://access.line.me/oauth2/v2.1/authorize");
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", LINE_CHANNEL_ID);
  auth.searchParams.set("redirect_uri", CALLBACK_URL);
  auth.searchParams.set("state", state);
  auth.searchParams.set("scope", "openid profile");
  auth.searchParams.set("nonce", nonce);
  return auth.toString();
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

    const url = new URL(req.url);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Explicit account-link start. Requires an already signed-in Supabase user.
    if (req.method === "POST") {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "ログインが必要です" }), { status: 401, headers: cors });
      }
      const body = await req.json().catch(() => ({}));
      const redirectTo = String(body.redirect_to || "");
      if (!ALLOWED_REDIRECTS.has(redirectTo)) {
        return new Response(JSON.stringify({ error: "redirect not allowed" }), { status: 400, headers: cors });
      }

      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data, error } = await userClient.auth.getUser();
      if (error || !data.user) {
        return new Response(JSON.stringify({ error: "ログインを確認できませんでした" }), { status: 401, headers: cors });
      }

      const authorizeUrl = await buildLineAuthorizeUrl(redirectTo, "link", data.user.id);
      return new Response(JSON.stringify({ authorize_url: authorizeUrl }), { status: 200, headers: cors });
    }

    if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    // Normal LINE login start.
    if (!code) {
      const redirectTo = url.searchParams.get("redirect_to") || "https://sake-log-git.pages.dev/";
      if (!ALLOWED_REDIRECTS.has(redirectTo)) return new Response("redirect not allowed", { status: 400 });
      return redirect(await buildLineAuthorizeUrl(redirectTo, "login"));
    }

    // LINE callback.
    const payload = await readState(state || "");
    const redirectTo = String(payload.redirectTo);

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: CALLBACK_URL,
      client_id: LINE_CHANNEL_ID,
      client_secret: LINE_CHANNEL_SECRET
    });
    const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody
    });
    const token = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || !token?.access_token || !token?.id_token) {
      return appError(redirectTo, "LINEのトークン取得に失敗しました");
    }

    const verifyBody = new URLSearchParams({
      id_token: token.id_token,
      client_id: LINE_CHANNEL_ID,
      nonce: String(payload.nonce)
    });
    const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyBody
    });
    const verified = await verifyRes.json().catch(() => null);
    if (!verifyRes.ok || !verified?.sub) {
      return appError(redirectTo, "LINEの本人確認に失敗しました");
    }

    const subHash = await sha256Hex(String(verified.sub));

    // Account linking: never infer identity. Only a signed state created from an
    // already authenticated session may write this mapping.
    if (payload.mode === "link") {
      const targetUserId = String(payload.userId || "");
      if (!targetUserId) return appError(redirectTo, "連携対象を確認できませんでした");

      const { data: linkedByLine, error: lineLookupError } = await admin
        .from("line_account_links")
        .select("user_id")
        .eq("line_sub_hash", subHash)
        .maybeSingle();
      if (lineLookupError) return appError(redirectTo, "LINE連携の確認に失敗しました");
      if (linkedByLine?.user_id && linkedByLine.user_id !== targetUserId) {
        return appError(redirectTo, "このLINEアカウントは別の和酒ログアカウントに連携済みです");
      }

      const { data: linkedByUser, error: userLookupError } = await admin
        .from("line_account_links")
        .select("line_sub_hash")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (userLookupError) return appError(redirectTo, "LINE連携の確認に失敗しました");
      if (linkedByUser?.line_sub_hash && linkedByUser.line_sub_hash !== subHash) {
        return appError(redirectTo, "別のLINEアカウントがすでに連携されています");
      }

      const { error: upsertError } = await admin
        .from("line_account_links")
        .upsert({ line_sub_hash: subHash, user_id: targetUserId, updated_at: new Date().toISOString() });
      if (upsertError) return appError(redirectTo, "LINE連携を保存できませんでした");

      const out = new URL(redirectTo);
      out.hash = "line_linked=1";
      return redirect(out.toString());
    }

    // Normal LINE login. Use a linked canonical user if present.
    const { data: linkRow, error: linkLookupError } = await admin
      .from("line_account_links")
      .select("user_id")
      .eq("line_sub_hash", subHash)
      .maybeSingle();
    if (linkLookupError) return appError(redirectTo, "LINE連携情報を確認できませんでした");

    let loginEmail = "";
    let isCanonical = false;

    if (linkRow?.user_id) {
      const { data: target, error: targetError } = await admin.auth.admin.getUserById(linkRow.user_id);
      if (targetError || !target.user?.email) return appError(redirectTo, "連携済みアカウントを確認できませんでした");
      loginEmail = target.user.email;
      isCanonical = true;
    } else {
      loginEmail = "line-" + subHash.slice(0, 40) + "@line.washulog.invalid";
    }

    const linkArgs: any = {
      type: "magiclink",
      email: loginEmail
    };
    if (!isCanonical) {
      linkArgs.options = {
        data: {
          provider: "line",
          full_name: verified.name || null,
          avatar_url: verified.picture || null
        }
      };
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink(linkArgs);
    if (linkError || !linkData) {
      console.error("generateLink failed", linkError);
      return appError(redirectTo, "和酒ログのログイン準備に失敗しました");
    }

    let tokenHash = (linkData as any)?.properties?.hashed_token || "";
    if (!tokenHash) {
      const action = (linkData as any)?.properties?.action_link || "";
      if (action) {
        const au = new URL(action);
        tokenHash = au.searchParams.get("token") || au.searchParams.get("token_hash") || "";
      }
    }
    if (!tokenHash) return appError(redirectTo, "ログイントークンを作成できませんでした");

    const out = new URL(redirectTo);
    out.hash = "line_token_hash=" + encodeURIComponent(tokenHash);
    return redirect(out.toString());
  } catch (e) {
    console.error(e);
    return new Response("LINE login failed", { status: 500, headers: { "Cache-Control": "no-store" } });
  }
});

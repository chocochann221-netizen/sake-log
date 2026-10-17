import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://sake-log-git.pages.dev"
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    ...(ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" }
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("login required");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "ログインが必要です" }), {
        status: 401,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" }
      });
    }

    const body = await req.json().catch(() => ({}));
    const confirmation = String(body.confirmation || "").trim();
    if (confirmation !== "DELETE_MY_ACCOUNT") {
      return new Response(JSON.stringify({ error: "削除確認が必要です" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" }
      });
    }

    const uid = userData.user.id;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const [
      { data: sakePhotos, error: sakeErr },
      { data: eventPhotos, error: eventErr },
      { data: menuScans, error: menuErr },
      { data: flyerSubmissions, error: flyerErr }
    ] = await Promise.all([
      admin.from("sake_photos").select("storage_path").eq("user_id", uid),
      admin.from("event_photos").select("storage_path").eq("user_id", uid),
      admin.from("menu_scans").select("storage_path").eq("user_id", uid),
      admin.from("event_flyer_submissions").select("image_path").eq("user_id", uid)
    ]);
    if (sakeErr) throw sakeErr;
    if (eventErr) throw eventErr;
    if (menuErr) throw menuErr;
    if (flyerErr) throw flyerErr;

    const sakePaths = (sakePhotos || []).map((x) => x.storage_path).filter(Boolean);
    const eventPaths = (eventPhotos || []).map((x) => x.storage_path).filter(Boolean);
    const menuPaths = (menuScans || []).map((x) => x.storage_path).filter(Boolean);
    const flyerPaths = (flyerSubmissions || []).map((x) => x.image_path).filter(Boolean);

    if (sakePaths.length) {
      const { error } = await admin.storage.from("sake-photos").remove(sakePaths);
      if (error) throw new Error("日本酒写真の削除に失敗しました");
    }
    if (eventPaths.length) {
      const { error } = await admin.storage.from("event-photos").remove(eventPaths);
      if (error) throw new Error("イベント写真の削除に失敗しました");
    }
    if (menuPaths.length) {
      const { error } = await admin.storage.from("sake-photos").remove(menuPaths);
      if (error) throw new Error("メニュー画像の削除に失敗しました");
    }
    if (flyerPaths.length) {
      const { error } = await admin.storage.from("event-flyers").remove(flyerPaths);
      if (error) throw new Error("イベントチラシ画像の削除に失敗しました");
    }

    const { error: eventDeleteError } = await admin
      .from("events")
      .delete()
      .eq("created_by", uid)
      .eq("event_origin", "user_created");
    if (eventDeleteError) throw eventDeleteError;

    const { error: affiliateDeleteError } = await admin
      .from("affiliate_clicks")
      .delete()
      .eq("user_id", uid);
    if (affiliateDeleteError) throw affiliateDeleteError;

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(uid);
    if (deleteUserError) throw deleteUserError;

    return new Response(JSON.stringify({ status: "deleted" }), {
      status: 200,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "アカウント削除に失敗しました"
    }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" }
    });
  }
});

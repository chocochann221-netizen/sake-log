import { ownedStoragePath } from "../_shared/storage-ownership.ts";
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
      return new Response(JSON.stringify({ error: "ログインが必要です" }), { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
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

    // Paginate before deleting anything: the API row limit is not a complete inventory.
    const buckets = new Map<string, Set<string>>();
    for (const [table, column, bucket] of [
      ["sake_photos", "storage_path", "sake-photos"],
      ["event_photos", "storage_path", "event-photos"],
      ["menu_scans", "storage_path", "sake-photos"],
      ["event_flyer_submissions", "image_path", "event-flyers"],
      ["personal_data_export_requests", "storage_path", "personal-data-exports"],
    ]) {
      const paths = buckets.get(bucket) || new Set<string>();
      buckets.set(bucket, paths);
      for (let offset = 0; ; ) {
        const { data, error } = await admin.from(table).select(column).eq("user_id", uid)
          .order("id").range(offset, offset + 999);
        if (error) throw error;
        if (!data?.length) break;
        for (const row of data) if (row[column]) paths.add(ownedStoragePath(uid, row[column]));
        offset += data.length;
      }
    }
    // Include orphan uploads and already-created export ZIPs before auth.users cascades
    // remove their references. Never list or remove another user's folder.
    async function collectFolder(bucket: string, prefix: string, paths: Set<string>) {
      for (let offset = 0; ; ) {
        const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
        if (error) throw error;
        if (!data?.length) break;
        for (const entry of data) {
          const path = ownedStoragePath(uid, prefix + "/" + entry.name);
          if (entry.id) paths.add(path);
          else await collectFolder(bucket, path, paths);
        }
        offset += data.length;
      }
    }
    for (const [bucket, paths] of buckets) await collectFolder(bucket, uid, paths);
    for (const [bucket, paths] of buckets) {
      const all = [...paths];
      for (let start = 0; start < all.length; start += 100) {
        const { error } = await admin.storage.from(bucket).remove(all.slice(start, start + 100));
        if (error) throw new Error("STORAGE_DELETE_FAILED");
      }
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
      error: "削除を完了できませんでした。通信状態を確認して再試行してください。一部の写真は削除済みの可能性があります。"
    }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" }
    });
  }
});

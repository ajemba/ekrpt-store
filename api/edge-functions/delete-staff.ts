// ════════════════════════════════════════════════════════════
// EKRPT — Supabase Edge Function: delete-staff
// Permanently removes a staff member's auth account.
// Only a super_admin (verified from their JWT) may call this.
//
// Deploy: Supabase dashboard → Edge Functions → Deploy a new function
//         → Via Editor. Name it exactly: delete-staff
//
// SECRETS: none to add — uses auto-provided
//   SUPABASE_URL  and  SUPABASE_SERVICE_ROLE_KEY.
//
// VERIFY JWT: leave ON. Called by a logged-in super_admin from the
//   browser; we verify the caller's token below.
//
// SAFETY: refuses to delete a super_admin account, and refuses to let
//   the caller delete themselves (prevents locking yourself out).
// ════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const { userId } = await req.json();
    if (!userId) return json({ error: "userId is required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Verify the CALLER is a super_admin.
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "Not authenticated" }, 401);
    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller) return json({ error: "Not authenticated" }, 401);

    const { data: callerProfile } = await admin
      .from("profiles").select("role").eq("id", caller.id).single();
    if (callerProfile?.role !== "super_admin")
      return json({ error: "Only the super admin can delete staff" }, 403);

    // 2. Safety checks.
    if (userId === caller.id) return json({ error: "You cannot delete your own account" }, 400);
    const { data: target } = await admin
      .from("profiles").select("role").eq("id", userId).single();
    if (target?.role === "super_admin")
      return json({ error: "A super admin account cannot be deleted here" }, 400);

    // 3. Delete the auth user. profiles row is removed via ON DELETE CASCADE
    //    (profiles.id references auth.users). If your FK is not cascade,
    //    the profile is downgraded below as a fallback.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      await admin.from("profiles").update({ role: "customer", suspended: true }).eq("id", userId);
      return json({ success: true, softDeleted: true, note: "Auth delete failed; downgraded to suspended customer instead." });
    }

    return json({ success: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

// ════════════════════════════════════════════════════════════
// EKRPT — Supabase Edge Function: create-staff
// Invites a new staff member by email and sets their role.
// Only a super_admin (verified from their JWT) may call this.
//
// Deploy: Supabase dashboard → Edge Functions → Deploy a new function
//         → Via Editor. Name it exactly: create-staff
//
// SECRETS: none to add — uses the auto-provided
//   SUPABASE_URL  and  SUPABASE_SERVICE_ROLE_KEY
//   (same names the working paypal-capture uses).
//
// VERIFY JWT: leave ON for this one. The browser sends the caller's
//   token in the Authorization header and we verify it's a super_admin.
//   (Unlike the payment functions, this is called by a logged-in admin,
//   not by an external server, so JWT verification is correct here.)
// ════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Roles a super_admin is allowed to assign (must match js/roles.js).
const ASSIGNABLE = ["admin", "marketing", "inventory", "finance", "maintenance", "employee"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const { email, fullName, role, department } = await req.json();
    if (!email || !fullName || !role) return json({ error: "email, fullName and role are required" }, 400);
    if (!ASSIGNABLE.includes(role)) return json({ error: `Role '${role}' is not assignable` }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Verify the CALLER is a super_admin.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Not authenticated" }, 401);

    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller) return json({ error: "Not authenticated" }, 401);

    const { data: callerProfile } = await admin
      .from("profiles").select("role").eq("id", caller.id).single();
    if (callerProfile?.role !== "super_admin")
      return json({ error: "Only the super admin can create staff" }, 403);

    // 2. Invite the new user by email (Supabase sends a set-password email).
    const { data: invited, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: "https://ekrpt.com/login.html",
      });
    if (inviteErr) {
      // Most common cause: the email already has an account.
      return json({ error: inviteErr.message || "Invite failed" }, 400);
    }

    // 3. Set their role + details in profiles. The handle_new_user trigger
    //    creates the row on signup; upsert covers either order of events.
    const { error: profErr } = await admin.from("profiles").upsert({
      id: invited.user.id,
      full_name: fullName,
      role,
      department: department || null,
      created_by: caller.id,
      suspended: false,
    }, { onConflict: "id" });
    if (profErr) return json({ error: "User invited but profile update failed: " + profErr.message }, 500);

    return json({ success: true, userId: invited.user.id });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

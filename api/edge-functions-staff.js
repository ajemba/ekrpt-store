// ═══════════════════════════════════════════════════════════
// EKRPT — Supabase Edge Functions (staff, secrets, campaigns)
// Deploy each as a separate function with the Supabase CLI:
//   supabase functions deploy create-staff
//   supabase functions deploy delete-staff
//   supabase functions deploy save-payment-secret
//   supabase functions deploy send-campaign
//
// These run on Supabase's servers (Deno), NOT in the browser.
// They use the SERVICE ROLE KEY which must NEVER be in client code.
// Set secrets with:
//   supabase secrets set SERVICE_ROLE_KEY=xxx
//   supabase secrets set PROJECT_URL=https://xxx.supabase.co
//   supabase secrets set BREVO_API_KEY=xxx
// ═══════════════════════════════════════════════════════════


/* ─────────────────────────────────────────────────────────
   FUNCTION 1: create-staff
   Invites a new staff member and sets their role.
   Only callable by a super_admin (verified via their JWT).
   File: supabase/functions/create-staff/index.ts
   ───────────────────────────────────────────────────────── */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { email, fullName, role, department } = await req.json();

    // Admin client (service role)
    const admin = createClient(
      Deno.env.get('PROJECT_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    );

    // 1. Verify the CALLER is a super_admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller } } = await admin.auth.getUser(token);
    if (!caller) throw new Error('Not authenticated');

    const { data: callerProfile } = await admin
      .from('profiles').select('role').eq('id', caller.id).single();
    if (callerProfile?.role !== 'super_admin')
      throw new Error('Only super admin can create staff');

    // 2. Invite the new user by email (sends a set-password email)
    const { data: invited, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: 'https://ekrpt.com/login.html',
      });
    if (inviteErr) throw inviteErr;

    // 3. Set their role + details in profiles
    await admin.from('profiles').update({
      full_name: fullName,
      role,
      department,
      created_by: caller.id,
    }).eq('id', invited.user.id);

    return new Response(JSON.stringify({ success: true, userId: invited.user.id }),
      { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});


/* ─────────────────────────────────────────────────────────
   FUNCTION 2: delete-staff
   File: supabase/functions/delete-staff/index.ts
   ───────────────────────────────────────────────────────── */
/*
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async (req) => {
  // (same CORS + super_admin check as above)
  const { userId } = await req.json();
  const admin = createClient(Deno.env.get('PROJECT_URL')!, Deno.env.get('SERVICE_ROLE_KEY')!);
  // verify caller is super_admin (see Function 1)...
  await admin.auth.admin.deleteUser(userId);
  return new Response(JSON.stringify({ success: true }), { headers: {...} });
});
*/


/* ─────────────────────────────────────────────────────────
   FUNCTION 3: save-payment-secret
   Stores a gateway secret key in the function's own secret store
   so it is never exposed to the browser.
   File: supabase/functions/save-payment-secret/index.ts
   ───────────────────────────────────────────────────────── */
/*
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async (req) => {
  // CORS + verify caller is super_admin...
  const { gateway, secretKey } = await req.json();

  // Option A (recommended): store in Supabase Vault
  const admin = createClient(Deno.env.get('PROJECT_URL')!, Deno.env.get('SERVICE_ROLE_KEY')!);
  await admin.rpc('vault_set', { name: `${gateway}_secret`, secret: secretKey });

  // Option B: store via Supabase Management API as a function secret
  //   (requires a personal access token; see manual)

  return new Response(JSON.stringify({ success: true }), { headers: {...} });
});

// Your verify-payment function then reads the secret server-side:
//   const paystackSecret = Deno.env.get('PAYSTACK_SECRET');  // set via `supabase secrets set`
//   ...and calls the gateway's verify endpoint.
*/


/* ─────────────────────────────────────────────────────────
   FUNCTION 3b: save-integration-secret
   Same idea as save-payment-secret, but for non-payment
   services (Brevo, HubSpot, Africa's Talking, social logins…).
   Stores the secret where the browser can't read it.
   File: supabase/functions/save-integration-secret/index.ts
   ───────────────────────────────────────────────────────── */
/*
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async (req) => {
  // CORS + verify caller is super_admin (see Function 1)...
  const { service, secretKey } = await req.json();
  const admin = createClient(Deno.env.get('PROJECT_URL')!, Deno.env.get('SERVICE_ROLE_KEY')!);

  // Store in Supabase Vault, keyed by service name
  await admin.rpc('vault_set', { name: `${service}_secret`, secret: secretKey });

  return new Response(JSON.stringify({ success: true }), { headers: {...} });
});

// Functions that need these read them server-side, e.g.:
//   send-email      → Deno.env.get('BREVO_API_KEY') or vault BREVO secret
//   crm-sync        → HubSpot token
//   send-otp        → Africa's Talking key
*/


/* ─────────────────────────────────────────────────────────
   FUNCTION 4: send-campaign
   Sends a marketing campaign to subscribers/customers via Brevo.
   File: supabase/functions/send-campaign/index.ts
   ───────────────────────────────────────────────────────── */
/*
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async (req) => {
  // CORS + verify caller is marketing OR super_admin...
  const { campaignId } = await req.json();
  const admin = createClient(Deno.env.get('PROJECT_URL')!, Deno.env.get('SERVICE_ROLE_KEY')!);

  const { data: campaign } = await admin.from('campaigns').select('*').eq('id', campaignId).single();

  // Build recipient list
  let recipients = [];
  if (campaign.audience === 'subscribers') {
    const { data } = await admin.from('subscribers').select('email, name');
    recipients = data;
  } else if (campaign.audience === 'customers') {
    const { data } = await admin.from('customers').select('email, full_name');
    recipients = data.map(c => ({ email: c.email, name: c.full_name }));
  } else {
    const subs = (await admin.from('subscribers').select('email, name')).data || [];
    const custs = (await admin.from('customers').select('email, full_name')).data || [];
    recipients = [...subs, ...custs.map(c => ({ email: c.email, name: c.full_name }))];
  }

  // Send via Brevo transactional email API
  let sent = 0;
  for (const r of recipients) {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': Deno.env.get('BREVO_API_KEY')!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'EKRPT Networking Labs', email: 'mail@ekrpt.com' },
        to: [{ email: r.email, name: r.name || '' }],
        subject: campaign.subject,
        htmlContent: `<div>${campaign.content}</div>`,
      }),
    });
    sent++;
  }

  await admin.from('campaigns').update({ status: 'sent', sent_at: new Date().toISOString(), recipients: sent }).eq('id', campaignId);
  return new Response(JSON.stringify({ success: true, recipients: sent }), { headers: {...} });
});
*/

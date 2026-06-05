/* ═══════════════════════════════════════════════════════════
   EKRPT — Admin Operations Module
   Staff management · Payment config · 2FA · Audit · Campaigns
   Most functions require super_admin (enforced by RLS too).
   ═══════════════════════════════════════════════════════════ */

// ── AUDIT LOG ────────────────────────────────────────────────
const Audit = (() => {
  const log = async (action, target, meta = {}) => {
    const sb = getSupabase();
    const user = RBAC.getUser() || await Auth.getUser();
    await sb.from('audit_log').insert({
      actor_id: user?.id,
      actor_email: user?.email,
      action, target, meta,
    });
  };
  const recent = async (limit = 100) => {
    const sb = getSupabase();
    const { data } = await sb.from('audit_log').select('*')
      .order('created_at', { ascending: false }).limit(limit);
    return data || [];
  };
  return { log, recent };
})();

// ── STAFF / SUB-ADMIN MANAGEMENT (super_admin) ──────────────
const Staff = (() => {

  // List all staff (non-customer roles)
  const getAll = async () => {
    const sb = getSupabase();
    const { data } = await sb.from('profiles')
      .select('*')
      .neq('role', 'customer')
      .order('created_at', { ascending: false });
    return data || [];
  };

  // Create a sub-admin / staff member.
  // Uses Supabase Edge Function 'create-staff' (admin API) so we can
  // invite by email + set role server-side with the service key.
  const create = async ({ email, fullName, role, department }) => {
    const res = await fetch(`${EKRPT_CONFIG.supabase.url}/functions/v1/create-staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (await Auth.getSession())?.access_token,
      },
      body: JSON.stringify({ email, fullName, role, department }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create staff');
    await Audit.log('staff.created', email, { role, department });
    return result;
  };

  // Change a staff member's role
  const setRole = async (userId, role) => {
    const sb = getSupabase();
    const { error } = await sb.from('profiles').update({ role }).eq('id', userId);
    if (error) throw error;
    await Audit.log('staff.role_changed', userId, { newRole: role });
  };

  // Suspend (block login) — keeps the record
  const suspend = async (userId, email) => {
    const sb = getSupabase();
    const { error } = await sb.from('profiles').update({ suspended: true }).eq('id', userId);
    if (error) throw error;
    await Audit.log('staff.suspended', email || userId, {});
  };

  // Re-activate
  const unsuspend = async (userId, email) => {
    const sb = getSupabase();
    const { error } = await sb.from('profiles').update({ suspended: false }).eq('id', userId);
    if (error) throw error;
    await Audit.log('staff.unsuspended', email || userId, {});
  };

  // Delete (downgrade to customer + remove staff access).
  // Full auth deletion happens via Edge Function 'delete-staff'.
  const remove = async (userId, email) => {
    const res = await fetch(`${EKRPT_CONFIG.supabase.url}/functions/v1/delete-staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (await Auth.getSession())?.access_token,
      },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      // fallback: downgrade to customer
      const sb = getSupabase();
      await sb.from('profiles').update({ role: 'customer', suspended: true }).eq('id', userId);
    }
    await Audit.log('staff.deleted', email || userId, {});
  };

  return { getAll, create, setRole, suspend, unsuspend, remove };
})();

// ── PAYMENT CONFIG (super_admin ONLY) ───────────────────────
const PaymentConfig = (() => {

  const getAll = async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('payment_config').select('*').order('gateway');
    if (error) throw error;
    return data || [];
  };

  // Save public config (public key, merchant id, enabled, live mode).
  // Secret keys are NOT saved here — they go to Edge Function secrets.
  const savePublic = async (gateway, { publicKey, merchantId, isEnabled, isLiveMode, webhookUrl }) => {
    const sb = getSupabase();
    const { error } = await sb.from('payment_config').update({
      public_key: publicKey,
      merchant_id: merchantId,
      is_enabled: isEnabled,
      is_live_mode: isLiveMode,
      webhook_url: webhookUrl,
      updated_at: new Date().toISOString(),
    }).eq('gateway', gateway);
    if (error) throw error;
    await Audit.log('keys.public_updated', gateway, { isEnabled, isLiveMode });
  };

  // Save SECRET key — sent to Edge Function which stores it in
  // Supabase Vault / function secret. Never stored in a normal table.
  const saveSecret = async (gateway, secretKey) => {
    const res = await fetch(`${EKRPT_CONFIG.supabase.url}/functions/v1/save-payment-secret`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (await Auth.getSession())?.access_token,
      },
      body: JSON.stringify({ gateway, secretKey }),
    });
    if (!res.ok) throw new Error('Failed to save secret key securely');
    const sb = getSupabase();
    await sb.from('payment_config').update({ secret_set: true }).eq('gateway', gateway);
    await Audit.log('keys.secret_updated', gateway, {});
  };

  return { getAll, savePublic, saveSecret };
})();

// ── INTEGRATIONS (non-payment services — super_admin only) ──
const Integrations = (() => {

  const getAll = async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('integration_config').select('*').order('service');
    if (error) throw error;
    return data || [];
  };

  // Save the public/non-sensitive parts (sender email, portal id, etc.)
  const savePublic = async (service, { publicValue, extraValue, isEnabled, config }) => {
    const sb = getSupabase();
    const patch = { is_enabled: isEnabled, updated_at: new Date().toISOString() };
    if (publicValue !== undefined) patch.public_value = publicValue;
    if (extraValue  !== undefined) patch.extra_value  = extraValue;
    if (config      !== undefined) patch.config       = config;
    const { error } = await sb.from('integration_config').update(patch).eq('service', service);
    if (error) throw error;
    await Audit.log('integration.public_updated', service, { isEnabled });
  };

  // Save the SECRET (API key / token) — routed to a secure Edge Function
  // that stores it in Supabase secrets, never in a browser-readable table.
  const saveSecret = async (service, secretKey) => {
    const res = await fetch(`${EKRPT_CONFIG.supabase.url}/functions/v1/save-integration-secret`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (await Auth.getSession())?.access_token,
      },
      body: JSON.stringify({ service, secretKey }),
    });
    if (!res.ok) throw new Error('Failed to save secret securely');
    const sb = getSupabase();
    await sb.from('integration_config').update({ secret_set: true }).eq('service', service);
    await Audit.log('integration.secret_updated', service, {});
  };

  return { getAll, savePublic, saveSecret };
})();

// ── 2FA (TOTP — Google Authenticator) for super_admin ──────
const TwoFA = (() => {

  // Begin enrollment — Supabase native MFA
  const enroll = async () => {
    const sb = getSupabase();
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'EKRPT 2FA' });
    if (error) throw error;
    // data.totp.qr_code (SVG data URL), data.totp.secret, data.id (factorId)
    return data;
  };

  // Verify the 6-digit code to finish enrollment
  const verifyEnrollment = async (factorId, code) => {
    const sb = getSupabase();
    const { data: challenge, error: cErr } = await sb.auth.mfa.challenge({ factorId });
    if (cErr) throw cErr;
    const { error } = await sb.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) throw error;
    await sb.from('profiles').update({ totp_enabled: true }).eq('id', (await Auth.getSession())?.user?.id);
    await Audit.log('2fa.enabled', 'self', {});
    return true;
  };

  // Verify at login
  const verifyLogin = async (factorId, code) => {
    const sb = getSupabase();
    const { data: challenge, error: cErr } = await sb.auth.mfa.challenge({ factorId });
    if (cErr) throw cErr;
    const { error } = await sb.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) throw error;
    return true;
  };

  // List enrolled factors
  const listFactors = async () => {
    const sb = getSupabase();
    const { data } = await sb.auth.mfa.listFactors();
    return data?.totp || [];
  };

  // Disable / unenroll
  const disable = async (factorId) => {
    const sb = getSupabase();
    const { error } = await sb.auth.mfa.unenroll({ factorId });
    if (error) throw error;
    await sb.from('profiles').update({ totp_enabled: false }).eq('id', (await Auth.getSession())?.user?.id);
    await Audit.log('2fa.disabled', 'self', {});
  };

  // Check assurance level (is user 2FA-verified this session?)
  const getAssuranceLevel = async () => {
    const sb = getSupabase();
    const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    return data; // { currentLevel: 'aal1'|'aal2', nextLevel }
  };

  return { enroll, verifyEnrollment, verifyLogin, listFactors, disable, getAssuranceLevel };
})();

// ── CAMPAIGNS (marketing) ───────────────────────────────────
const Campaigns = (() => {

  const getAll = async () => {
    const sb = getSupabase();
    const { data } = await sb.from('campaigns').select('*').order('created_at', { ascending: false });
    return data || [];
  };

  const create = async (campaign) => {
    const sb = getSupabase();
    const user = await Auth.getSession();
    const { data, error } = await sb.from('campaigns')
      .insert({ ...campaign, created_by: user?.user?.id }).select().single();
    if (error) throw error;
    return data;
  };

  const update = async (id, updates) => {
    const sb = getSupabase();
    const { error } = await sb.from('campaigns').update(updates).eq('id', id);
    if (error) throw error;
  };

  // Send campaign now — triggers Edge Function that uses Brevo
  const send = async (id) => {
    const res = await fetch(`${EKRPT_CONFIG.supabase.url}/functions/v1/send-campaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (await Auth.getSession())?.access_token,
      },
      body: JSON.stringify({ campaignId: id }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Send failed');
    await Audit.log('campaign.sent', id, { recipients: result.recipients });
    return result;
  };

  return { getAll, create, update, send };
})();

// ── FINANCE ──────────────────────────────────────────────────
const Finance = (() => {

  const getTransactions = async (filters = {}) => {
    const sb = getSupabase();
    let q = sb.from('transactions').select('*').order('created_at', { ascending: false });
    if (filters.type) q = q.eq('type', filters.type);
    if (filters.limit) q = q.limit(filters.limit);
    const { data } = await q;
    return data || [];
  };

  const getSummary = async () => {
    const sb = getSupabase();
    const { data } = await sb.from('transactions').select('type, amount, gateway');
    const tx = data || [];
    const payments = tx.filter(t => t.type === 'payment').reduce((s, t) => s + Number(t.amount), 0);
    const refunds  = tx.filter(t => t.type === 'refund').reduce((s, t) => s + Number(t.amount), 0);
    const fees     = tx.filter(t => t.type === 'fee').reduce((s, t) => s + Number(t.amount), 0);
    const byGateway = {};
    tx.filter(t => t.type === 'payment').forEach(t => {
      byGateway[t.gateway] = (byGateway[t.gateway] || 0) + Number(t.amount);
    });
    return { payments, refunds, fees, net: payments - refunds - fees, byGateway };
  };

  const refund = async (orderId, amount, reason) => {
    const sb = getSupabase();
    await sb.from('transactions').insert({ order_id: orderId, type: 'refund', amount, status: 'completed', notes: reason });
    await sb.from('orders').update({ payment_status: 'refunded' }).eq('id', orderId);
    await Audit.log('finance.refund', orderId, { amount, reason });
  };

  return { getTransactions, getSummary, refund };
})();

// ── MAINTENANCE / SYSTEM ────────────────────────────────────
const Maintenance = (() => {
  const getLogs = async (level = null, limit = 100) => {
    const sb = getSupabase();
    let q = sb.from('system_log').select('*').order('created_at', { ascending: false }).limit(limit);
    if (level) q = q.eq('level', level);
    const { data } = await q;
    return data || [];
  };
  const log = async (level, source, message, meta = {}) => {
    const sb = getSupabase();
    await sb.from('system_log').insert({ level, source, message, meta });
  };
  return { getLogs, log };
})();

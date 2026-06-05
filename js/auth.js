/* ═══════════════════════════════════════════════════════════
   EKRPT — Auth Module
   Handles: Email/Password, Magic Link, Phone OTP,
            Google OAuth, Facebook OAuth, TikTok OAuth,
            Guest Checkout, Session management
   ═══════════════════════════════════════════════════════════ */

const Auth = (() => {

  // ── SESSION ──────────────────────────────────────────────
  const getSession = async () => {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    return session;
  };

  const getUser = async () => {
    const session = await getSession();
    if (!session) return null;
    const sb = getSupabase();
    const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
    return { ...session.user, profile: data };
  };

  const isLoggedIn = async () => !!(await getSession());

  const isAdmin = async () => {
    const user = await getUser();
    return user?.profile?.role === 'admin';
  };

  // ── GUARD: redirect if not logged in ───────────────────
  const requireAuth = async (redirectTo = '/login.html') => {
    const loggedIn = await isLoggedIn();
    if (!loggedIn) {
      sessionStorage.setItem('ekrpt_redirect', location.href);
      location.href = redirectTo;
    }
    return loggedIn;
  };

  // ── GUARD: redirect if not admin ───────────────────────
  const requireAdmin = async () => {
    const admin = await isAdmin();
    if (!admin) location.href = '/login.html?admin=1';
    return admin;
  };

  // ── EMAIL SIGN UP ───────────────────────────────────────
  const signUp = async ({ email, password, fullName, phone }) => {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: EKRPT_CONFIG.store.domain + '/login.html?confirmed=1',
      }
    });
    if (error) throw error;
    // Create profile row
    if (data.user) {
      await sb.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        phone,
        role: 'customer',
      });
      // Sync to CRM
      await CRM.syncContact({ email, fullName, phone, source: 'signup' });
    }
    return data;
  };

  // ── EMAIL SIGN IN ───────────────────────────────────────
  const signIn = async ({ email, password }) => {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  // ── MAGIC LINK ──────────────────────────────────────────
  const sendMagicLink = async (email) => {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: EKRPT_CONFIG.store.domain + '/account/index.html' }
    });
    if (error) throw error;
  };

  // ── PHONE OTP: SEND ─────────────────────────────────────
  const sendPhoneOTP = async (phone) => {
    const sb = getSupabase();
    // Supabase uses E.164 format: +2348012345678
    const formatted = phone.startsWith('+') ? phone : EKRPT_CONFIG.auth.phoneCountryCode + phone.replace(/^0/, '');
    const { error } = await sb.auth.signInWithOtp({ phone: formatted });
    if (error) throw error;
    return formatted;
  };

  // ── PHONE OTP: VERIFY ───────────────────────────────────
  const verifyPhoneOTP = async (phone, token) => {
    const sb = getSupabase();
    const { data, error } = await sb.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw error;
    // Create/update profile
    if (data.user) {
      await sb.from('profiles').upsert({ id: data.user.id, phone, role: 'customer' });
    }
    return data;
  };

  // ── GOOGLE OAUTH ────────────────────────────────────────
  const signInWithGoogle = async () => {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: EKRPT_CONFIG.store.domain + '/account/index.html' }
    });
    if (error) throw error;
  };

  // ── FACEBOOK OAUTH ──────────────────────────────────────
  const signInWithFacebook = async () => {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: EKRPT_CONFIG.store.domain + '/account/index.html' }
    });
    if (error) throw error;
  };

  // ── TIKTOK OAUTH (custom via Supabase) ──────────────────
  const signInWithTikTok = async () => {
    // TikTok uses Supabase custom OAuth
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'tiktok',
      options: { redirectTo: EKRPT_CONFIG.store.domain + '/account/index.html' }
    });
    if (error) throw error;
  };

  // ── GUEST SESSION ───────────────────────────────────────
  const setGuestSession = (guestData) => {
    sessionStorage.setItem('ekrpt_guest', JSON.stringify({
      ...guestData,
      isGuest: true,
      createdAt: new Date().toISOString(),
    }));
  };

  const getGuestSession = () => {
    const raw = sessionStorage.getItem('ekrpt_guest');
    return raw ? JSON.parse(raw) : null;
  };

  const clearGuestSession = () => sessionStorage.removeItem('ekrpt_guest');

  // ── SIGN OUT ─────────────────────────────────────────────
  const signOut = async () => {
    const sb = getSupabase();
    await sb.auth.signOut();
    clearGuestSession();
    Cart.clear();
    location.href = '/index.html';
  };

  // ── PASSWORD RESET ──────────────────────────────────────
  const sendPasswordReset = async (email) => {
    const sb = getSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: EKRPT_CONFIG.store.domain + '/login.html?reset=1',
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword) => {
    const sb = getSupabase();
    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  // ── UPDATE PROFILE ──────────────────────────────────────
  const updateProfile = async (updates) => {
    const session = await getSession();
    if (!session) throw new Error('Not logged in');
    const sb = getSupabase();
    const { error } = await sb.from('profiles').update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq('id', session.user.id);
    if (error) throw error;
  };

  // ── AUTH STATE CHANGE ───────────────────────────────────
  const onAuthChange = (callback) => {
    const sb = getSupabase();
    return sb.auth.onAuthStateChange(callback);
  };

  // ── UI HELPERS ───────────────────────────────────────────
  const updateNavUI = async () => {
    const user = await getUser();
    const navActions = document.getElementById('nav-actions');
    if (!navActions) return;

    if (user) {
      const initials = (user.profile?.full_name || user.email || '?')
        .split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
      navActions.innerHTML = `
        <button class="cart-btn" onclick="location.href='/checkout.html'">
          🛒 Cart <span class="cart-count">0</span>
        </button>
        <div class="nav-user-menu" style="position:relative">
          <button class="nav-avatar" onclick="toggleUserMenu()" style="width:36px;height:36px;border-radius:50%;background:var(--blue);color:white;border:none;cursor:pointer;font-weight:700;font-size:13px">${initials}</button>
          <div id="user-dropdown" style="display:none;position:absolute;right:0;top:44px;background:white;border:1px solid var(--gray-100);border-radius:var(--radius-lg);padding:8px;min-width:180px;box-shadow:var(--shadow-md);z-index:200">
            <a href="/account/index.html" style="display:block;padding:8px 12px;font-size:13px;color:var(--gray-700);text-decoration:none;border-radius:var(--radius)">My Account</a>
            <a href="/account/orders.html" style="display:block;padding:8px 12px;font-size:13px;color:var(--gray-700);text-decoration:none;border-radius:var(--radius)">My Orders</a>
            ${user.profile?.role === 'admin' ? '<a href="/admin/index.html" style="display:block;padding:8px 12px;font-size:13px;color:var(--blue);font-weight:500;text-decoration:none;border-radius:var(--radius)">Admin Panel</a>' : ''}
            <hr style="border:none;border-top:1px solid var(--gray-100);margin:4px 0"/>
            <button onclick="Auth.signOut()" style="display:block;width:100%;padding:8px 12px;font-size:13px;color:var(--red);text-align:left;background:none;border:none;cursor:pointer;border-radius:var(--radius);font-family:var(--font-body)">Sign out</button>
          </div>
        </div>`;
    } else {
      navActions.innerHTML = `
        <button class="cart-btn" onclick="location.href='/checkout.html'">
          🛒 Cart <span class="cart-count">0</span>
        </button>
        <a href="/login.html" class="btn btn-secondary btn-sm">Sign in</a>
        <a href="/login.html#signup" class="btn btn-primary btn-sm">Get started</a>`;
    }
    Cart.updateBadge();
  };

  // ── MFA / 2FA at login ──────────────────────────────────
  // List the user's verified TOTP factors
  const listMfaFactors = async () => {
    const sb = getSupabase();
    try {
      const { data } = await sb.auth.mfa.listFactors();
      return (data?.totp || []).filter(f => f.status === 'verified');
    } catch (e) { return []; }
  };

  // Does this session still need to step up to 2FA (aal1 → aal2)?
  const needsMfa = async () => {
    const sb = getSupabase();
    try {
      const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      return data && data.nextLevel === 'aal2' && data.nextLevel !== data.currentLevel;
    } catch (e) { return false; }
  };

  // Verify a 6-digit code at login
  const verifyMfa = async (factorId, code) => {
    const sb = getSupabase();
    const { data: challenge, error: cErr } = await sb.auth.mfa.challenge({ factorId });
    if (cErr) throw cErr;
    const { error } = await sb.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) throw error;
    return true;
  };

  return {
    getSession, getUser, isLoggedIn, isAdmin,
    requireAuth, requireAdmin,
    signUp, signIn, sendMagicLink,
    sendPhoneOTP, verifyPhoneOTP,
    signInWithGoogle, signInWithFacebook, signInWithTikTok,
    setGuestSession, getGuestSession, clearGuestSession,
    signOut, sendPasswordReset, updatePassword, updateProfile,
    onAuthChange, updateNavUI,
    listMfaFactors, needsMfa, verifyMfa,
  };
})();

function toggleUserMenu() {
  const dd = document.getElementById('user-dropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.nav-user-menu')) {
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.style.display = 'none';
  }
});

/* ═══════════════════════════════════════════════════════════
   EKRPT Networking Labs — Central Configuration
   Edit this file with your own keys before going live.
   NEVER put secret keys here — only public/anon keys.
   ═══════════════════════════════════════════════════════════ */

const EKRPT_CONFIG = {

  // ── STORE INFO ──────────────────────────────────────────
  store: {
    name:    'EKRPT Networking Labs',
    tagline: 'Digital & Networking Equipment',
    email:   'office@ekrpt.com',
    smtp:    'mail@ekrpt.com',
    phone:   '+234 800 000 0000',
    address: 'Lagos, Nigeria',
    domain:  'https://ekrpt.com',
  },

  // ── SUPABASE ─────────────────────────────────────────────
  // Sign up free at supabase.com → Project Settings → API
  supabase: {
    url:     'https://vpbxcysyulbvgmluwoxv.supabase.co',
    anonKey: 'sb_publishable_-guolUgI8XHhL_sPMMurFQ_RJ8GXv-L',
  },

  // ── PAYMENTS (public keys only) ───────────────────────────
  payments: {
    paystack: {
      publicKey: 'pk_live_YOUR_PAYSTACK_KEY',
      // Get from: dashboard.paystack.com → Settings → API
    },
    flutterwave: {
      publicKey: 'FLWPUBK-YOUR_FLW_KEY',
      // Get from: dashboard.flutterwave.com → Settings → API
    },
    paypal: {
      clientId: 'YOUR_PAYPAL_CLIENT_ID',
      currency: 'USD',
      // Get from: developer.paypal.com → My Apps
    },
    cryptomus: {
      merchantId: 'YOUR_CRYPTOMUS_MERCHANT_ID',
      // Secret key goes in Supabase Edge Function only
    },
  },

  // ── CURRENCY ──────────────────────────────────────────────
  currency: {
    code:    'NGN',
    symbol:  '₦',
    usdRate: 1609, // Update this periodically
  },

  // ── SHIPPING ──────────────────────────────────────────────
  shipping: {
    defaultFee:    2500,
    freeThreshold: 200000, // Free delivery over ₦200,000
    zones: [
      { name: 'Lagos',      fee: 2500,  days: 'Same day' },
      { name: 'Abuja',      fee: 5000,  days: '1–2 days' },
      { name: 'Port Harcourt', fee: 5000, days: '2–3 days' },
      { name: 'Other',      fee: 7500,  days: '3–5 days' },
    ],
  },

  // ── AUTH ──────────────────────────────────────────────────
  auth: {
    googleClientId:   '', // optional, handled by Supabase
    phoneCountryCode: '+234',
    sessionKey: 'ekrpt_session',
  },

  // ── SOCIAL / CRM ──────────────────────────────────────────
  hubspot: {
    portalId: '', // from HubSpot account settings
  },
  brevo: {
    // SMTP configured server-side (Supabase Edge Function)
    // No keys needed here
  },

};

// ── SUPABASE CLIENT ───────────────────────────────────────────
// Loaded from CDN — no install needed
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = window.supabase.createClient(
      EKRPT_CONFIG.supabase.url,
      EKRPT_CONFIG.supabase.anonKey
    );
  }
  return _supabase;
}

// ── CURRENCY FORMATTER ────────────────────────────────────────
function fmtNGN(amount) {
  return EKRPT_CONFIG.currency.symbol + Number(amount).toLocaleString('en-NG');
}
function fmtUSD(amount) {
  return '$' + Number(amount).toFixed(2);
}
function toUSD(ngnAmount) {
  return (ngnAmount / EKRPT_CONFIG.currency.usdRate).toFixed(2);
}

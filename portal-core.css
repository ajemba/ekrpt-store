-- ═══════════════════════════════════════════════════════════
-- EKRPT — Schema Extension v2
-- Roles, Sub-Admins, Payment Keys, Campaigns, 2FA, Audit Log
-- Run AFTER schema.sql in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── EXTEND PROFILES with new roles + suspension + 2FA ──────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin','admin','marketing','inventory','finance','maintenance','employee','customer'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS totp_enabled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS totp_secret text; -- encrypted
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department text;

-- ── PAYMENT PROCESSOR KEYS (super_admin only) ──────────────
-- NOTE: Public keys can live here. SECRET keys belong in
-- Supabase Edge Function secrets, NOT this table.
-- This table stores config + which keys are "set" (never the raw secret).
CREATE TABLE IF NOT EXISTS payment_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway         text UNIQUE NOT NULL CHECK (gateway IN ('paystack','flutterwave','paypal','cryptomus')),
  is_enabled      boolean DEFAULT false,
  is_live_mode    boolean DEFAULT false,
  public_key      text,           -- safe to store (public)
  merchant_id     text,           -- safe (cryptomus merchant id is semi-public)
  secret_set      boolean DEFAULT false, -- flag only; actual secret in Edge Function
  webhook_url     text,
  config          jsonb DEFAULT '{}',
  updated_by      uuid REFERENCES auth.users,
  updated_at      timestamptz DEFAULT now()
);

-- ── MARKETING CAMPAIGNS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  type          text DEFAULT 'email' CHECK (type IN ('email','sms','push')),
  subject       text,
  content       text,
  status        text DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sent','cancelled')),
  audience      text DEFAULT 'all', -- 'all' | 'customers' | 'subscribers' | tag
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  recipients    integer DEFAULT 0,
  opens         integer DEFAULT 0,
  clicks        integer DEFAULT 0,
  created_by    uuid REFERENCES auth.users,
  created_at    timestamptz DEFAULT now()
);

-- ── BILLING / TRANSACTIONS (finance) ───────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid REFERENCES orders ON DELETE SET NULL,
  type          text CHECK (type IN ('payment','refund','payout','fee')),
  gateway       text,
  amount        numeric NOT NULL,
  currency      text DEFAULT 'NGN',
  status        text DEFAULT 'completed',
  reference     text,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- ── MAINTENANCE / SYSTEM LOG ───────────────────────────────
CREATE TABLE IF NOT EXISTS system_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level         text DEFAULT 'info' CHECK (level IN ('info','warning','error','critical')),
  source        text,
  message       text,
  meta          jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

-- ── AUDIT LOG (who did what — super_admin visibility) ──────
CREATE TABLE IF NOT EXISTS audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES auth.users,
  actor_email   text,
  action        text NOT NULL,    -- 'admin.created', 'admin.suspended', 'keys.updated', etc.
  target        text,             -- what was acted upon
  meta          jsonb DEFAULT '{}',
  ip            text,
  created_at    timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- RLS for new tables
-- ════════════════════════════════════════════════════════════

ALTER TABLE payment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log      ENABLE ROW LEVEL SECURITY;

-- Helper: is current user a super_admin?
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin');
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_role(roles text[])
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY(roles));
$$ LANGUAGE sql SECURITY DEFINER;

-- PAYMENT CONFIG: super_admin ONLY (read + write)
CREATE POLICY "Super admin payment config" ON payment_config
  FOR ALL USING (is_super_admin());

-- CAMPAIGNS: marketing + super_admin
CREATE POLICY "Marketing manage campaigns" ON campaigns
  FOR ALL USING (has_role(ARRAY['super_admin','marketing']));

-- TRANSACTIONS: finance + super_admin
CREATE POLICY "Finance view transactions" ON transactions
  FOR ALL USING (has_role(ARRAY['super_admin','finance']));

-- SYSTEM LOG: maintenance + super_admin
CREATE POLICY "Maintenance view logs" ON system_log
  FOR ALL USING (has_role(ARRAY['super_admin','maintenance']));

-- AUDIT LOG: super_admin read; system writes
CREATE POLICY "Super admin read audit" ON audit_log
  FOR SELECT USING (is_super_admin());
CREATE POLICY "Anyone insert audit" ON audit_log
  FOR INSERT WITH CHECK (true);

-- ── UPDATE PROFILES policy so super_admin manages all staff ─
DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_super_admin());
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Super admin manage all profiles" ON profiles
  FOR ALL USING (is_super_admin());

-- ════════════════════════════════════════════════════════════
-- SEED payment_config rows (empty, ready to fill)
-- ════════════════════════════════════════════════════════════
INSERT INTO payment_config (gateway, is_enabled) VALUES
  ('paystack', false),
  ('flutterwave', false),
  ('paypal', false),
  ('cryptomus', false)
ON CONFLICT (gateway) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- INTEGRATIONS (non-payment services — email, CRM, SMS, social)
-- Same security model as payment_config:
--   • public/non-sensitive values stored here (super_admin only)
--   • secret API keys go to Edge Function secrets (secret_set flag)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS integration_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service       text UNIQUE NOT NULL,   -- 'brevo','hubspot','africastalking', etc.
  is_enabled    boolean DEFAULT false,
  public_value  text,                   -- safe: sender email, portal id, client id…
  extra_value   text,                   -- safe: second public field (e.g. username)
  secret_set    boolean DEFAULT false,  -- flag only; real secret lives in Edge Function
  config        jsonb DEFAULT '{}',
  updated_by    uuid REFERENCES auth.users,
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE integration_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin integrations" ON integration_config
  FOR ALL USING (is_super_admin());

-- Seed the supported non-payment services (empty, ready to fill)
INSERT INTO integration_config (service, is_enabled) VALUES
  ('brevo', false),
  ('hubspot', false),
  ('africastalking', false),
  ('google_login', false),
  ('facebook_login', false),
  ('tiktok_login', false),
  ('whatsapp', false),
  ('analytics', false)
ON CONFLICT (service) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- MAKE FIRST SUPER ADMIN (run after creating your account)
-- Replace with your email:
-- ════════════════════════════════════════════════════════════
-- UPDATE profiles SET role = 'super_admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');

-- ════════════════════════════════════════════════════════════
-- EKRPT — schema-v9: payment_config public read (for storefront)
-- ════════════════════════════════════════════════════════════
-- The storefront (running as a logged-in customer or anon) must read
-- the PUBLIC payment key (e.g. PayPal client id) to load the payment
-- SDK. The original policy allowed only super_admin to read
-- payment_config, so the checkout got an empty result and PayPal
-- failed with "no paypal client id".
--
-- This adds a public SELECT. SAFE because secret keys are NOT stored in
-- this table — they live in Supabase Edge Function Secrets. Only public
-- keys + flags are here. Writes are still super_admin-only.
--
-- Safe to run multiple times.
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone can read payment config" ON payment_config;
CREATE POLICY "Anyone can read payment config" ON payment_config
  FOR SELECT
  USING (true);

GRANT SELECT ON payment_config TO anon, authenticated;

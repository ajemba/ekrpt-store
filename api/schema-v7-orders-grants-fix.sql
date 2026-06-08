-- ════════════════════════════════════════════════════════════
-- EKRPT — schema-v7: orders table GRANTs (fix 401 on insert)
-- ════════════════════════════════════════════════════════════
-- SYMPTOM: products / site_settings / payment_config all load fine
-- (HTTP 200) using the publishable key, but inserting into `orders`
-- returns HTTP 401. The API key is valid (other tables work), so the
-- problem is table-level: the anon / authenticated roles are missing
-- the GRANTs needed to write to orders + order_events. RLS policies
-- only take effect AFTER the role has table privileges; without the
-- GRANT, PostgREST rejects the request before RLS is evaluated.
--
-- This grants the right privileges to both roles, then re-affirms the
-- insert policies. Safe to run multiple times.
-- Run the whole file once in: Supabase → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════

-- ── Table privileges ─────────────────────────────────────────
-- Guests (anon) need to INSERT orders and read them back (SELECT
-- via .select() after insert). Logged-in users (authenticated) too.
GRANT SELECT, INSERT ON orders        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON orders TO authenticated;

GRANT SELECT, INSERT ON order_events  TO anon, authenticated;

-- ── RLS must stay ON (no-op if already on) ───────────────────
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- ── Re-affirm insert policies (idempotent) ───────────────────
DROP POLICY IF EXISTS "Users create orders" ON orders;
CREATE POLICY "Users create orders" ON orders
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users create order events" ON order_events;
CREATE POLICY "Users create order events" ON order_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_events.order_id
        AND (o.user_id = auth.uid() OR o.user_id IS NULL)
    )
  );

-- ── Verify (optional) ────────────────────────────────────────
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name = 'orders'
-- ORDER BY grantee, privilege_type;

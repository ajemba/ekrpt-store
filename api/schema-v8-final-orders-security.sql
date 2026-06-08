-- ════════════════════════════════════════════════════════════
-- EKRPT — schema-v8: FINAL orders security state (Option B)
-- ════════════════════════════════════════════════════════════
-- This documents the orders/order_events security model now LIVE on
-- the database after Phase 1–2 debugging. Login is REQUIRED to check
-- out (no guest orders), which closed the guest-PII exposure hole.
--
-- This file is the source-of-truth for the orders RLS. It is safe to
-- re-run (idempotent). If you ever rebuild the database, run:
--   schema.sql → schema-v2 → schema-v3 → (v4 RLS fix) → schema-v8
--
-- NOTE: schema-v5/v6/v7 were incremental debugging steps; v8 supersedes
-- their orders/order_events policies with the final secure version.
-- ════════════════════════════════════════════════════════════

ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- READ: a logged-in user sees ONLY their own orders.
-- Admins keep their separate "Staff manage orders" (FOR ALL) policy.
DROP POLICY IF EXISTS "Users see own orders" ON orders;
CREATE POLICY "Users see own orders" ON orders
  FOR SELECT
  USING (auth.uid() = user_id);

-- CREATE: only logged-in users, only as themselves. No anonymous inserts.
DROP POLICY IF EXISTS "Users create orders" ON orders;
CREATE POLICY "Users create orders" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ORDER EVENTS: only the order's owner can add an event.
DROP POLICY IF EXISTS "Users create order events" ON order_events;
CREATE POLICY "Users create order events" ON order_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_events.order_id AND o.user_id = auth.uid()
    )
  );

-- Lock down the anon role: guests cannot read or write orders at all.
REVOKE INSERT ON orders       FROM anon;
REVOKE INSERT ON order_events FROM anon;
REVOKE SELECT ON orders       FROM anon;

-- Logged-in users keep the access they need.
GRANT SELECT, INSERT ON orders       TO authenticated;
GRANT SELECT, INSERT ON order_events TO authenticated;

-- ── Verify (optional) ────────────────────────────────────────
-- SELECT policyname, cmd, roles::text, with_check
-- FROM pg_policies WHERE tablename IN ('orders','order_events');

-- ════════════════════════════════════════════════════════════
-- EKRPT — schema-v6: checkout RLS fix (orders + order_events)
-- ════════════════════════════════════════════════════════════
-- SYMPTOM: "new row violates row-level security policy for table orders"
-- at checkout. The insert policy that allows guest/customer checkout is
-- missing or was overwritten on the live database. This re-creates it,
-- and also adds the missing order_events insert policy (next thing that
-- would break right after orders).
--
-- Safe to run multiple times (drops then recreates each policy).
-- Run this whole file once in: Supabase → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════

-- Make sure RLS is on (no-op if already on)
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- ── ORDERS: allow guest + customer checkout inserts ──────────
DROP POLICY IF EXISTS "Users create orders" ON orders;

CREATE POLICY "Users create orders" ON orders
  FOR INSERT
  WITH CHECK (true);   -- allow guest checkout (anon) and logged-in customers

-- ── ORDER_EVENTS: allow inserting an event for an order the ──
-- ── caller owns, or a guest order (user_id IS NULL) ──────────
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
-- SELECT tablename, polname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('orders','order_events')
-- ORDER BY tablename, polname;

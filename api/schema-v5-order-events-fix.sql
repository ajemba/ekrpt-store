-- ════════════════════════════════════════════════════════════
-- EKRPT — schema-v5: order_events INSERT fix
-- ════════════════════════════════════════════════════════════
-- WHY: order_events has RLS enabled but NO insert policy. The only
-- policies are a SELECT (owner) and an admin FOR ALL. When a guest or
-- a normal customer places an order, Orders.create() inserts into
-- `orders` (allowed via "Users create orders" WITH CHECK true) and
-- then inserts a row into `order_events`. That second insert is
-- rejected by RLS, so the order is created but the checkout reports a
-- failure to the customer.
--
-- FIX: allow inserting an order_events row for an order the caller is
-- allowed to see — i.e. an order they own (user_id = auth.uid()), or a
-- guest order (user_id IS NULL). Admins already covered by FOR ALL.
--
-- Safe to run multiple times (drops then recreates the policy).
-- ════════════════════════════════════════════════════════════

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

-- Verify (optional): list policies on order_events
-- SELECT polname, cmd FROM pg_policies WHERE tablename = 'order_events';

-- ════════════════════════════════════════════════════════════
-- EKRPT — cleanup: remove TEST orders (run before launch)
-- ════════════════════════════════════════════════════════════
-- During debugging, many test orders were created (failed PayPal
-- attempts left pending orders). This removes UNPAID orders so the
-- admin + customer dashboards are clean for launch.
--
-- ⚠️ Review first! This deletes ALL unpaid orders. If you have real
-- unpaid orders you want to keep, DO NOT run the blanket version —
-- use the targeted version instead.
--
-- Run in: Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════

-- OPTION A — delete ALL unpaid orders (clears every test order):
DELETE FROM order_events
  WHERE order_id IN (SELECT id FROM orders WHERE payment_status <> 'paid');
DELETE FROM orders
  WHERE payment_status <> 'paid';

-- OPTION B — (instead) delete specific orders by number, safer:
-- DELETE FROM order_events
--   WHERE order_id IN (SELECT id FROM orders WHERE order_number IN ('EKRPT-2026-XXXX','EKRPT-2026-YYYY'));
-- DELETE FROM orders
--   WHERE order_number IN ('EKRPT-2026-XXXX','EKRPT-2026-YYYY');

-- Verify what remains:
-- SELECT order_number, payment_status, status FROM orders ORDER BY created_at DESC;

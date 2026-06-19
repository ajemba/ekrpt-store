-- ════════════════════════════════════════════════════════════════
-- EKRPT — schema v11: Products RLS fix (enable super_admin / inventory delete)
-- ════════════════════════════════════════════════════════════════
-- PROBLEM: the original "Admin manage products" policy only matched
-- role = 'admin', so super_admin and inventory staff could not
-- insert / update / DELETE products. Deletes failed silently under RLS.
--
-- FIX: replace it with a policy using the has_role() helper (defined in
-- schema-v2), covering the roles that should manage inventory.
--
-- Safe to run multiple times.
-- Run this in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════

-- Drop the old role='admin'-only policy
DROP POLICY IF EXISTS "Admin manage products" ON products;

-- Recreate with has_role(), covering the inventory-managing roles.
-- (has_role already treats super_admin as all-powerful in its definition,
--  but we list it explicitly for clarity.)
CREATE POLICY "Staff manage products" ON products
  FOR ALL
  USING (has_role(ARRAY['super_admin','admin','inventory']))
  WITH CHECK (has_role(ARRAY['super_admin','admin','inventory']));

-- Note: the public read policy ("Products public read", is_active = true)
-- is unchanged and still applies for storefront visitors.

-- inventory_log rows are removed automatically via ON DELETE CASCADE
-- (product_id uuid REFERENCES products ON DELETE CASCADE in schema.sql),
-- so deleting a product cleans up its stock history with no orphan rows.

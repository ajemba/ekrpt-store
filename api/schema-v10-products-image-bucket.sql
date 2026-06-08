-- ════════════════════════════════════════════════════════════
-- EKRPT — schema v10: products image storage bucket
-- Run this ONCE in Supabase → SQL Editor.
-- Creates a public 'products' bucket so the admin can upload real
-- product photos and the storefront can display them.
-- Mirrors the existing 'site'/'blog' bucket setup (schema-v3).
-- ════════════════════════════════════════════════════════════

-- 1. Create the public bucket (id + name = 'products').
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Anyone can READ product images (storefront is public).
CREATE POLICY "Public read products bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

-- 3. Only super_admin / inventory / marketing staff can UPLOAD.
CREATE POLICY "Staff upload products bucket" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'products'
    AND has_role(ARRAY['super_admin','inventory','marketing'])
  );

-- 4. Same staff can UPDATE/overwrite (the helper uses upsert).
CREATE POLICY "Staff update products bucket" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'products'
    AND has_role(ARRAY['super_admin','inventory','marketing'])
  );

-- ── NOTE ──
-- The products table needs an image_url column. If it doesn't exist yet:
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;

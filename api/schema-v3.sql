-- ═══════════════════════════════════════════════════════════
-- EKRPT — Schema Extension v3
-- Site Appearance Settings + Blog (SEO-friendly)
-- Run AFTER schema.sql and schema-v2.sql
-- ═══════════════════════════════════════════════════════════

-- ── SITE SETTINGS (single row, public-readable, super_admin-writable)
CREATE TABLE IF NOT EXISTS site_settings (
  id            int PRIMARY KEY DEFAULT 1,
  -- Branding
  site_name     text DEFAULT 'EKRPT Networking Labs',
  tagline       text DEFAULT 'Digital & Networking Equipment',
  logo_url      text,                       -- uploaded to Supabase Storage
  favicon_url   text,
  -- Theme colors
  color_primary   text DEFAULT '#1a8fc4',
  color_accent    text DEFAULT '#d94040',
  color_dark      text DEFAULT '#0f1b24',
  -- Homepage hero
  hero_title    text DEFAULT 'Connect Nigeria. Faster.',
  hero_subtitle text DEFAULT 'Starlink kits, EKRPT routers, MiFi & modems — licensed, in stock, delivered.',
  hero_cta_text text DEFAULT 'Shop Now',
  hero_cta_link text DEFAULT '/products.html',
  hero_image_url text,
  -- Image slider (array of {image_url, caption, link})
  slider        jsonb DEFAULT '[]',
  -- About + footer
  about_title   text DEFAULT 'About EKRPT Networking Labs',
  about_text    text DEFAULT 'EKRPT Networking Labs is a licensed, CAC-registered Nigerian company supplying digital and networking equipment.',
  footer_text   text DEFAULT '© EKRPT Networking Labs. All rights reserved.',
  footer_about  text DEFAULT 'Your trusted source for Starlink and networking hardware in Nigeria.',
  -- Contact
  contact_email text DEFAULT 'office@ekrpt.com',
  contact_phone text DEFAULT '+234 800 000 0000',
  contact_address text DEFAULT 'Lagos, Nigeria',
  -- Social links
  social        jsonb DEFAULT '{}',         -- {facebook, instagram, twitter, tiktok, whatsapp, linkedin, youtube}
  -- Announcement bar
  announce_enabled boolean DEFAULT false,
  announce_text    text,
  announce_link    text,
  -- SEO defaults
  seo_title       text DEFAULT 'EKRPT Networking Labs — Starlink & Networking Equipment in Nigeria',
  seo_description text DEFAULT 'Buy Starlink kits, routers, MiFi and modems from a licensed Nigerian supplier. Fast nationwide delivery.',
  seo_keywords    text DEFAULT 'Starlink Nigeria, routers, MiFi, modems, networking equipment',
  seo_og_image    text,                      -- social share image
  seo_twitter     text DEFAULT '@ekrpt',
  -- Misc
  business_hours  text DEFAULT 'Mon–Sat, 9am–6pm',
  updated_by    uuid REFERENCES auth.users,
  updated_at    timestamptz DEFAULT now()
);

-- Seed the single settings row
INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
-- Anyone (even logged-out shoppers) can READ settings to render the site
CREATE POLICY "Public read site settings" ON site_settings
  FOR SELECT USING (true);
-- Only super_admin can change them
CREATE POLICY "Super admin write site settings" ON site_settings
  FOR ALL USING (is_super_admin());


-- ── BLOG POSTS (SEO-friendly) ──────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- URL + identity
  slug          text UNIQUE NOT NULL,        -- e.g. 'how-to-install-starlink-nigeria'
  title         text NOT NULL,
  excerpt       text,                        -- short summary (used in cards + meta description fallback)
  content       text,                        -- HTML / markdown body
  cover_image   text,                        -- hero image for the post
  cover_alt     text,                        -- alt text (SEO + accessibility)
  -- Taxonomy
  category      text DEFAULT 'General',
  tags          text[] DEFAULT '{}',
  -- Author
  author_id     uuid REFERENCES auth.users,
  author_name   text,
  -- Publishing
  status        text DEFAULT 'draft' CHECK (status IN ('draft','published','scheduled')),
  published_at  timestamptz,
  reading_time  int DEFAULT 1,               -- minutes
  views         int DEFAULT 0,
  featured      boolean DEFAULT false,
  -- Per-post SEO overrides (fall back to title/excerpt if blank)
  seo_title       text,
  seo_description text,
  seo_keywords    text,
  og_image        text,                      -- defaults to cover_image
  canonical_url   text,
  no_index        boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_slug_idx   ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS blog_status_idx ON blog_posts (status, published_at DESC);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
-- Public can read ONLY published posts
CREATE POLICY "Public read published posts" ON blog_posts
  FOR SELECT USING (status = 'published');
-- super_admin + marketing can do everything (drafts included)
CREATE POLICY "Staff manage blog" ON blog_posts
  FOR ALL USING (has_role(ARRAY['super_admin','marketing']));

-- Increment view counter safely
CREATE OR REPLACE FUNCTION increment_post_views(post_slug text)
RETURNS void AS $$
  UPDATE blog_posts SET views = views + 1 WHERE slug = post_slug AND status = 'published';
$$ LANGUAGE sql SECURITY DEFINER;


-- ── STORAGE BUCKETS (run once; or create in Dashboard → Storage) ──
-- Public bucket for site images (logo, hero, slider, blog covers)
INSERT INTO storage.buckets (id, name, public)
VALUES ('site', 'site', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('blog', 'blog', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read; authenticated staff upload
CREATE POLICY "Public read site bucket" ON storage.objects
  FOR SELECT USING (bucket_id IN ('site','blog'));
CREATE POLICY "Staff upload site bucket" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id IN ('site','blog') AND has_role(ARRAY['super_admin','marketing']));
CREATE POLICY "Staff update site bucket" ON storage.objects
  FOR UPDATE USING (bucket_id IN ('site','blog') AND has_role(ARRAY['super_admin','marketing']));

-- ═══════════════════════════════════════════════════════════
-- EKRPT Networking Labs — Supabase Database Schema
-- Paste this entire file into:
-- supabase.com → Your Project → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PROFILES (extends auth.users) ─────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name   text,
  phone       text,
  address     text,
  city        text,
  role        text DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ── PRODUCTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  slug          text UNIQUE,
  description   text,
  category      text CHECK (category IN ('starlink','router','mifi')),
  price         numeric NOT NULL CHECK (price >= 0),
  compare_price numeric,
  stock         integer DEFAULT 0 CHECK (stock >= 0),
  sku           text UNIQUE,
  badge         text CHECK (badge IN ('new','hot','branded') OR badge IS NULL),
  emoji         text DEFAULT '📦',
  image_url     text,
  images        jsonb DEFAULT '[]',
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── ORDERS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number       text UNIQUE NOT NULL,
  user_id            uuid REFERENCES auth.users ON DELETE SET NULL,
  guest_email        text,
  guest_phone        text,
  items              jsonb NOT NULL DEFAULT '[]',
  subtotal           numeric DEFAULT 0,
  delivery_fee       numeric DEFAULT 2500,
  discount           numeric DEFAULT 0,
  total              numeric DEFAULT 0,
  status             text DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_method     text,
  payment_reference  text,
  payment_status     text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  shipping_address   jsonb,
  notes              text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- ── ORDER EVENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid REFERENCES orders ON DELETE CASCADE,
  status      text,
  note        text,
  created_at  timestamptz DEFAULT now()
);

-- ── CUSTOMERS / CRM ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                 uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name          text,
  email              text UNIQUE,
  phone              text,
  total_orders       integer DEFAULT 0,
  total_spent        numeric DEFAULT 0,
  last_order_at      timestamptz,
  tags               text[] DEFAULT '{}',
  notes              text,
  hubspot_contact_id text,
  created_at         timestamptz DEFAULT now()
);

-- ── INVENTORY LOG ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid REFERENCES products ON DELETE CASCADE,
  change      integer NOT NULL,
  reason      text,
  order_id    uuid REFERENCES orders ON DELETE SET NULL,
  admin_id    uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- ── NEWSLETTER SUBSCRIBERS ────────────────────────────────
CREATE TABLE IF NOT EXISTS subscribers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text UNIQUE NOT NULL,
  name        text,
  subscribed  boolean DEFAULT true,
  source      text DEFAULT 'homepage',
  created_at  timestamptz DEFAULT now()
);

-- ── PROMO CODES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,
  discount_type   text CHECK (discount_type IN ('percent','fixed')),
  discount_value  numeric,
  min_order       numeric DEFAULT 0,
  max_uses        integer,
  used_count      integer DEFAULT 0,
  expires_at      timestamptz,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes    ENABLE ROW LEVEL SECURITY;

-- Profiles: users see/edit own, admins see all
CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Products: public read active, admin write
CREATE POLICY "Products public read" ON products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admin manage products" ON products
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Orders: user sees own orders, admin sees all
CREATE POLICY "Users see own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users create orders" ON orders
  FOR INSERT WITH CHECK (true); -- Allow guest checkout

CREATE POLICY "Admin manage orders" ON orders
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Order events: same as orders
CREATE POLICY "Users see own order events" ON order_events
  FOR SELECT USING (EXISTS (SELECT 1 FROM orders WHERE id = order_id AND user_id = auth.uid()));

CREATE POLICY "Admin manage order events" ON order_events
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Customers: users see own, admin sees all
CREATE POLICY "Users see own customer record" ON customers
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin manage customers" ON customers
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Inventory: admin only
CREATE POLICY "Admin manage inventory" ON inventory_log
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Subscribers: insert only (public), admin read all
CREATE POLICY "Public subscribe" ON subscribers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin read subscribers" ON subscribers
  FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Promos: public read active codes
CREATE POLICY "Public read active promos" ON promo_codes
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admin manage promos" ON promo_codes
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════

-- Auto-create profile on sign up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'customer')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO customers (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update customer stats when order is paid
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS trigger AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND OLD.payment_status = 'unpaid' AND NEW.user_id IS NOT NULL THEN
    UPDATE customers SET
      total_orders = total_orders + 1,
      total_spent  = total_spent + NEW.total,
      last_order_at = now()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_order_paid
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_customer_stats();

-- ════════════════════════════════════════════════════════════
-- SEED DATA — Initial EKRPT products
-- ════════════════════════════════════════════════════════════

INSERT INTO products (name, slug, description, category, price, stock, sku, badge, emoji) VALUES
('Starlink Mini Kit',          'starlink-mini',          'Ultra-compact portable Starlink dish. Ideal for travel, vehicles, and remote sites. Self-orienting.',          'starlink', 280000, 8,  'SL-MINI-001', 'new',     '📡'),
('Starlink Gen3 Standard',     'starlink-gen3-standard', 'Third-generation dish with faster speeds, improved weather resistance, and self-orienting mount.',            'starlink', 420000, 5,  'SL-GEN3-001', 'hot',     '🛰️'),
('Starlink V4 High Perf.',     'starlink-v4-hp',         'Latest V4 hardware for enterprises and high-demand connectivity. Gigabit capable satellite internet.',        'starlink', 520000, 3,  'SL-V4-001',   'new',     '📡'),
('EKRPT ProRouter X1',         'ekrpt-prorouter-x1',     'EKRPT branded dual-band AC1200 router. Optimized firmware for all major Nigerian ISPs. Easy app setup.',     'router',   28500,  20, 'EK-RX1-001',  'branded', '📶'),
('EKRPT MeshNode 3-Pack',      'ekrpt-meshnode-3',       'Whole-home Wi-Fi mesh kit. Covers 450sqm seamlessly. Smart roaming, parental controls included.',            'router',   65000,  12, 'EK-MN3-001',  'branded', '🌐'),
('EKRPT MiFi Pro 4G+',         'ekrpt-mifi-pro-4g',      'EKRPT branded 4G+ MiFi device. Supports 10 simultaneous devices. 3000mAh battery. Unlocked.',              'mifi',     18500,  30, 'EK-M4G-001',  'branded', '📱'),
('EKRPT MiFi 5G',              'ekrpt-mifi-5g',          'Next-gen 5G pocket router. Sub-6GHz SA/NSA dual-mode. Up to 2.1Gbps peak. Compact, travel-ready.',          'mifi',     34000,  14, 'EK-M5G-001',  'new',     '⚡'),
('EKRPT USB LTE Modem',        'ekrpt-usb-lte',          'Plug-and-play LTE USB modem. CAT6. 300Mbps download. Works with any laptop. No driver install needed.',     'mifi',     9500,   40, 'EK-USB-001',  NULL,      '🔌')
ON CONFLICT (slug) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- MAKE YOURSELF ADMIN
-- Run this AFTER creating your account through the store:
-- Replace 'your-email@example.com' with your actual email
-- ════════════════════════════════════════════════════════════

-- UPDATE profiles SET role = 'admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');

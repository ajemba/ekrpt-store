# EKRPT Networking Labs — Complete Store Blueprint
## 0–10 Production-Ready, GitHub Pages Hosted

---

## ARCHITECTURE OVERVIEW

```
EKRPT Store (100% Free Stack)
├── Frontend: GitHub Pages (static HTML/CSS/JS)
├── Backend-as-a-Service: Supabase (PostgreSQL + Auth + Realtime + Storage)
├── Auth: Supabase Auth (Email, Phone/OTP, OAuth: Google/Facebook/TikTok)
├── SMTP / Email: Brevo (300 free emails/day)
├── Phone OTP: Supabase Phone Auth via Twilio (free tier) OR Africa's Talking
├── CRM: Built-in (Supabase) + HubSpot Free CRM webhook integration
├── Payments: Paystack + Flutterwave + PayPal + Cryptomus
├── Dynamic Updates: GitHub Actions (CI/CD) — auto-deploy on push
├── Image Storage: Supabase Storage (free tier: 1GB)
├── Analytics: Tinybird free tier OR Plausible (open source)
└── Domain: ekrpt.com via Namecheap → GitHub Pages
```

---

## FREE TOOLS STACK (All Free Tiers)

| Layer            | Tool              | Free Tier                          | Sign Up                        |
|------------------|-------------------|------------------------------------|-------------------------------|
| Database         | Supabase          | 500MB DB, 2 projects               | supabase.com                  |
| Auth             | Supabase Auth     | 50,000 MAU                         | supabase.com                  |
| Email SMTP       | Brevo             | 300 emails/day                     | brevo.com                     |
| Phone OTP        | Africa's Talking  | Free sandbox + $15 credit          | africastalking.com            |
| File Storage     | Supabase Storage  | 1GB                                | supabase.com                  |
| Hosting          | GitHub Pages      | Unlimited static                   | github.com                    |
| CI/CD            | GitHub Actions    | 2000 min/month                     | github.com                    |
| CRM              | HubSpot Free      | Unlimited contacts                 | hubspot.com                   |
| Payments         | Paystack          | Free (% per txn)                   | paystack.com                  |
| Payments         | Flutterwave       | Free (% per txn)                   | flutterwave.com               |
| Payments         | PayPal            | Free (% per txn)                   | paypal.com                    |
| Crypto Payments  | Cryptomus         | Free (% per txn)                   | cryptomus.com                 |
| Error Tracking   | Sentry            | 5000 errors/month free             | sentry.io                     |
| Forms/Webhooks   | Formspree         | 50 submissions/month               | formspree.io                  |
| Search           | Pagefind          | Free, runs in-browser              | pagefind.app                  |

---

## DATABASE SCHEMA (Supabase / PostgreSQL)

### Tables

```sql
-- USERS (extends Supabase auth.users)
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  full_name text,
  phone text,
  address text,
  city text,
  role text DEFAULT 'customer', -- 'customer' | 'admin'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- PRODUCTS
products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  category text, -- 'starlink' | 'router' | 'mifi' | 'branded'
  price numeric NOT NULL,
  compare_price numeric,
  stock integer DEFAULT 0,
  sku text UNIQUE,
  badge text, -- 'new' | 'hot' | 'branded' | null
  emoji text,
  image_url text,
  images jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- ORDERS
orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE, -- EKRPT-2025-0001
  user_id uuid REFERENCES auth.users,
  guest_email text,
  guest_phone text,
  items jsonb NOT NULL, -- [{product_id, name, price, qty, emoji}]
  subtotal numeric,
  delivery_fee numeric DEFAULT 2500,
  total numeric,
  status text DEFAULT 'pending', -- pending|confirmed|processing|shipped|delivered|cancelled
  payment_method text, -- paystack|flutterwave|paypal|crypto
  payment_reference text,
  payment_status text DEFAULT 'unpaid', -- unpaid|paid|refunded
  shipping_address jsonb, -- {name, phone, address, city}
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- ORDER STATUS HISTORY
order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders,
  status text,
  note text,
  created_at timestamptz DEFAULT now()
)

-- CUSTOMERS / CRM
customers (
  id uuid PRIMARY KEY REFERENCES auth.users,
  full_name text,
  email text UNIQUE,
  phone text,
  total_orders integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  last_order_at timestamptz,
  tags text[] DEFAULT '{}', -- ['vip', 'wholesale', 'repeat']
  notes text,
  hubspot_contact_id text,
  created_at timestamptz DEFAULT now()
)

-- INVENTORY LOG
inventory_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products,
  change integer, -- +10 (restock), -1 (sale)
  reason text, -- 'sale' | 'restock' | 'adjustment' | 'damage'
  order_id uuid REFERENCES orders,
  admin_id uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now()
)

-- NEWSLETTER SUBSCRIBERS
subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  name text,
  subscribed boolean DEFAULT true,
  source text, -- 'homepage' | 'checkout' | 'popup'
  created_at timestamptz DEFAULT now()
)

-- PROMO CODES
promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  discount_type text, -- 'percent' | 'fixed'
  discount_value numeric,
  min_order numeric DEFAULT 0,
  max_uses integer,
  used_count integer DEFAULT 0,
  expires_at timestamptz,
  is_active boolean DEFAULT true
)
```

### Row Level Security (RLS) Rules
```sql
-- Customers see only their own orders
CREATE POLICY "Users see own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Admins see everything
CREATE POLICY "Admins see all orders" ON orders
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Products are public read
CREATE POLICY "Products public read" ON products
  FOR SELECT USING (is_active = true);

-- Only admins can write products
CREATE POLICY "Admins manage products" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

---

## PAGE MAP

```
/ (index.html)           → Homepage
/products.html           → Product catalog
/product.html?id=xxx     → Product detail page
/about.html              → About Us
/contact.html            → Contact
/login.html              → Sign in / Sign up / Phone OTP / Social
/checkout.html           → Cart + Checkout + 4 Payment gateways
/order-confirm.html      → Order confirmation
/account/
  index.html             → Dashboard (orders, profile)
  orders.html            → Order history + tracking
  profile.html           → Edit profile
/admin/
  index.html             → Admin dashboard (KPIs, charts)
  orders.html            → All orders + status management
  products.html          → Inventory management
  customers.html         → CRM — customer list, tags, notes
  analytics.html         → Revenue analytics
  settings.html          → Store settings, SMTP, payment keys
```

---

## AUTH FLOWS

### Customer Auth
1. Email + Password (Supabase)
2. Magic Link Email (Supabase)
3. Phone OTP (Supabase + Africa's Talking)
4. Google OAuth (Supabase OAuth)
5. Facebook OAuth (Supabase OAuth)
6. TikTok OAuth (Supabase OAuth custom)
7. Guest Checkout (email + phone, no account)

### Admin Auth
- Same Supabase Auth
- Role check: `profiles.role === 'admin'`
- Admin routes redirect to /login.html if not admin

---

## GITHUB ACTIONS CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy EKRPT Store
on:
  push:
    branches: [main]
  workflow_dispatch: # Manual trigger from GitHub UI

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

**Update flow:**
1. Edit any file on GitHub.com (browser, no coding tools needed)
2. Click Commit → GitHub Actions auto-runs
3. Site live in 30 seconds
4. Or: I give you updated code → you paste into GitHub file editor → done

---

## EMAIL TEMPLATES (via Brevo SMTP: mail@ekrpt.com)

| Trigger              | Template                               |
|---------------------|----------------------------------------|
| Sign up             | Welcome to EKRPT email                |
| Order placed        | Order confirmation + summary           |
| Order confirmed     | Payment confirmed, processing begins   |
| Order shipped       | Shipped with tracking info             |
| Order delivered     | Delivered, request review              |
| Password reset      | Reset link                             |
| Newsletter          | Promotional emails                     |
| Low stock alert     | Admin notification                     |
| New order (admin)   | Admin new order notification           |

---

## PAYMENT WEBHOOK FLOW

Since GitHub Pages is static, payment verification uses Supabase Edge Functions (free):

```
Customer pays (Paystack/Flutterwave/PayPal/Crypto)
    ↓
Payment provider sends webhook to:
    https://<project>.supabase.co/functions/v1/payment-webhook
    ↓
Supabase Edge Function:
  1. Verifies webhook signature
  2. Updates orders.payment_status = 'paid'
  3. Updates orders.status = 'confirmed'
  4. Deducts inventory (inventory_log insert)
  5. Triggers Brevo email (order confirmation)
  6. Syncs customer to HubSpot CRM
    ↓
Frontend polls Supabase Realtime for order status update
```

---

## ENVIRONMENT VARIABLES (store in GitHub Secrets + Supabase)

```bash
# Supabase (public — safe in frontend)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...

# Payment keys (public)
PAYSTACK_PUBLIC_KEY=pk_live_...
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-...
PAYPAL_CLIENT_ID=...

# Secret keys (Supabase Edge Functions only — never in frontend)
PAYSTACK_SECRET=sk_live_...
FLUTTERWAVE_SECRET=FLWSECK-...
PAYPAL_SECRET=...
CRYPTOMUS_MERCHANT_ID=...
CRYPTOMUS_API_KEY=...
BREVO_API_KEY=...
HUBSPOT_API_KEY=...
AT_API_KEY=...  # Africa's Talking
AT_USERNAME=... # Africa's Talking username
```

---

## SETUP CHECKLIST (in order)

- [ ] 1. Create GitHub account → new repo `ekrpt-site` (public)
- [ ] 2. Upload all files, enable GitHub Pages
- [ ] 3. Sign up at supabase.com → new project `ekrpt`
- [ ] 4. Run SQL schema (copy from BLUEPRINT.md) in Supabase SQL editor
- [ ] 5. Enable Supabase Auth → Email, Phone, Google, Facebook providers
- [ ] 6. Sign up at brevo.com → get SMTP credentials → add `mail@ekrpt.com` sender
- [ ] 7. Sign up at africastalking.com → get sandbox API key
- [ ] 8. Sign up at paystack.com → get public + secret keys
- [ ] 9. Sign up at flutterwave.com → get public + secret keys
- [ ] 10. Update `js/config.js` with your Supabase URL + anon key + payment keys
- [ ] 11. Set up Namecheap DNS A records → GitHub Pages
- [ ] 12. Set custom domain in GitHub Pages settings
- [ ] 13. Create your admin account in Supabase Auth, then run:
         `UPDATE profiles SET role = 'admin' WHERE id = 'your-user-id';`
- [ ] 14. Add products via /admin/products.html
- [ ] 15. Test order flow end-to-end
- [ ] 16. Go live! 🚀

---

## SECURITY CHECKLIST

- [ ] Supabase RLS enabled on all tables
- [ ] Admin role check on all /admin/ pages
- [ ] Payment webhooks verified server-side (Edge Functions)
- [ ] CORS configured in Supabase
- [ ] No secret keys in frontend JavaScript
- [ ] HTTPS enforced (GitHub Pages + custom domain)
- [ ] Rate limiting on auth (Supabase default)
- [ ] Input sanitization on all forms

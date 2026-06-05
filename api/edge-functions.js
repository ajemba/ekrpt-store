// ═══════════════════════════════════════════════════════════
// EKRPT — Supabase Edge Functions
// Deploy these at: supabase.com → Edge Functions
// Each function goes in its own file in supabase/functions/
// ═══════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// FILE: supabase/functions/verify-payment/index.ts
// Verifies Paystack or Flutterwave payment server-side
// ─────────────────────────────────────────────────────────────
/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { gateway, reference, orderId } = await req.json();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let verified = false;

  if (gateway === 'paystack') {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET')}` }
    });
    const data = await res.json();
    verified = data.data?.status === 'success';

  } else if (gateway === 'flutterwave') {
    const res = await fetch(`https://api.flutterwave.com/v3/transactions/${reference}/verify`, {
      headers: { Authorization: `Bearer ${Deno.env.get('FLW_SECRET')}` }
    });
    const data = await res.json();
    verified = data.data?.status === 'successful';
  }

  if (verified) {
    await supabase.from('orders').update({
      payment_status: 'paid',
      payment_reference: reference,
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);

    // Send confirmation email
    await sendOrderConfirmationEmail(supabase, orderId);
  }

  return new Response(JSON.stringify({ success: verified }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
*/

// ─────────────────────────────────────────────────────────────
// FILE: supabase/functions/send-email/index.ts
// Sends transactional emails via Brevo SMTP
// ─────────────────────────────────────────────────────────────
/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BREVO_API = 'https://api.brevo.com/v3/smtp/email';

serve(async (req) => {
  const { to, template, data } = await req.json();

  const templates = {
    welcome: {
      subject: 'Welcome to EKRPT Networking Labs 👋',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1a8fc4;padding:24px;text-align:center">
            <h1 style="color:white;margin:0;font-size:24px">EKRPT Networking Labs</h1>
          </div>
          <div style="padding:32px;background:#f7fbfe">
            <h2 style="color:#111d28">Welcome, ${data.name}! 👋</h2>
            <p style="color:#4a5d6e">Your account has been created successfully. You can now shop for our full range of networking equipment.</p>
            <a href="https://ekrpt.com/products.html" style="display:inline-block;background:#1a8fc4;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;margin-top:16px">Shop Now →</a>
          </div>
          <div style="padding:16px;text-align:center;color:#9aaabb;font-size:12px">
            © 2025 EKRPT Networking Labs · office@ekrpt.com · Lagos, Nigeria
          </div>
        </div>`
    },
    order_confirmed: {
      subject: `Order Confirmed — ${data.orderNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#111d28;padding:24px">
            <h1 style="color:white;margin:0;font-size:20px">EKRPT Networking Labs</h1>
          </div>
          <div style="padding:32px;background:#f7fbfe">
            <h2 style="color:#111d28">✅ Order Confirmed!</h2>
            <p style="color:#4a5d6e">Your order <strong>${data.orderNumber}</strong> has been confirmed and is being processed.</p>
            <div style="background:white;border:1px solid #e4eaf0;border-radius:10px;padding:20px;margin:20px 0">
              ${(data.items||[]).map(i => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e4eaf0"><span>${i.emoji||''} ${i.name} ×${i.qty}</span><span style="font-weight:600">₦${(i.price*i.qty).toLocaleString()}</span></div>`).join('')}
              <div style="display:flex;justify-content:space-between;padding:12px 0 0;font-weight:700;font-size:16px"><span>Total</span><span>₦${data.total?.toLocaleString()}</span></div>
            </div>
            <p style="color:#4a5d6e">We will notify you when your order ships. For support: <a href="mailto:office@ekrpt.com">office@ekrpt.com</a></p>
          </div>
          <div style="padding:16px;text-align:center;color:#9aaabb;font-size:12px">© 2025 EKRPT Networking Labs</div>
        </div>`
    },
    order_shipped: {
      subject: `Your Order ${data.orderNumber} Has Shipped 🚚`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#111d28;padding:24px"><h1 style="color:white;margin:0">EKRPT Networking Labs</h1></div>
          <div style="padding:32px">
            <h2>🚚 Your order is on its way!</h2>
            <p>Order <strong>${data.orderNumber}</strong> has been shipped.</p>
            ${data.tracking ? `<p>Tracking: <strong>${data.tracking}</strong></p>` : ''}
            <p>Estimated delivery: <strong>${data.eta || '1–3 business days'}</strong></p>
          </div>
        </div>`
    },
    password_reset: {
      subject: 'Reset your EKRPT password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h2>Password Reset Request</h2>
          <p>Click the button below to reset your password. This link expires in 1 hour.</p>
          <a href="${data.resetUrl}" style="display:inline-block;background:#1a8fc4;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">Reset Password</a>
          <p style="color:#9aaabb;font-size:12px;margin-top:20px">If you didn't request this, ignore this email.</p>
        </div>`
    },
  };

  const tpl = templates[template];
  if (!tpl) return new Response('Unknown template', { status: 400 });

  const res = await fetch(BREVO_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': Deno.env.get('BREVO_API_KEY')!,
    },
    body: JSON.stringify({
      sender: { name: 'EKRPT Networking Labs', email: 'mail@ekrpt.com' },
      to: [{ email: to }],
      subject: tpl.subject,
      htmlContent: tpl.html,
    }),
  });

  return new Response(JSON.stringify({ ok: res.ok }), { headers: { 'Content-Type': 'application/json' } });
});
*/

// ─────────────────────────────────────────────────────────────
// FILE: supabase/functions/crm-sync/index.ts
// Syncs new contacts to HubSpot CRM
// ─────────────────────────────────────────────────────────────
/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { email, fullName, phone, source } = await req.json();
  const [firstName, ...rest] = (fullName || '').split(' ');
  const lastName = rest.join(' ');

  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('HUBSPOT_API_KEY')}`,
    },
    body: JSON.stringify({
      properties: {
        email, firstname: firstName, lastname: lastName,
        phone, lead_source: 'EKRPT Store - ' + source,
      }
    }),
  });

  return new Response(JSON.stringify({ ok: res.ok }), { headers: { 'Content-Type': 'application/json' } });
});
*/

// ─────────────────────────────────────────────────────────────
// FILE: supabase/functions/paypal-create/index.ts
// Creates a PayPal order server-side
// ─────────────────────────────────────────────────────────────
/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const getPayPalToken = async () => {
  const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(Deno.env.get('PAYPAL_CLIENT_ID') + ':' + Deno.env.get('PAYPAL_SECRET'))}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
};

serve(async (req) => {
  const { amount, orderId, orderNumber } = await req.json();
  const token = await getPayPalToken();
  const res = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId,
        description: 'EKRPT Order ' + orderNumber,
        amount: { currency_code: 'USD', value: amount.toString() },
      }],
    }),
  });
  const data = await res.json();
  return new Response(JSON.stringify({ paypalOrderId: data.id }), { headers: { 'Content-Type': 'application/json' } });
});
*/

// ─────────────────────────────────────────────────────────────
// FILE: supabase/functions/cryptomus-create/index.ts
// Creates Cryptomus crypto payment invoice
// ─────────────────────────────────────────────────────────────
/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHash } from "https://deno.land/std@0.168.0/crypto/mod.ts";

serve(async (req) => {
  const { amount, currency, orderId, orderNumber } = await req.json();
  const merchantId = Deno.env.get('CRYPTOMUS_MERCHANT_ID')!;
  const apiKey = Deno.env.get('CRYPTOMUS_API_KEY')!;

  const payload = {
    amount: amount.toString(),
    currency,
    order_id: orderId,
    url_callback: `${Deno.env.get('SUPABASE_URL')}/functions/v1/cryptomus-webhook`,
    url_return: 'https://ekrpt.com/order-confirm.html',
    url_success: 'https://ekrpt.com/order-confirm.html?paid=1',
  };

  const payloadBase64 = btoa(JSON.stringify(payload));
  const sign = createHash("md5").update(payloadBase64 + apiKey).toString("hex");

  const res = await fetch('https://api.cryptomus.com/v1/payment', {
    method: 'POST',
    headers: { 'merchant': merchantId, 'sign': sign, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  return new Response(JSON.stringify({
    url: data.result?.url,
    address: data.result?.address,
    amount: data.result?.payer_amount,
    currency: data.result?.payer_currency,
    expiry: data.result?.expired_at,
  }), { headers: { 'Content-Type': 'application/json' } });
});
*/

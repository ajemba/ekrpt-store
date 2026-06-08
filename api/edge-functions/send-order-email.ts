// ════════════════════════════════════════════════════════════
// EKRPT — Supabase Edge Function: send-order-email
// Sends order / payment / shipping emails via the Brevo API.
//
// Deploy: Supabase dashboard → Edge Functions → Deploy a new function
//         → Via Editor. Name it EXACTLY: send-order-email  (no .ts)
//
// SECRETS to add (Supabase → Edge Functions → Secrets):
//   BREVO_API_KEY   (Brevo → SMTP & API → API Keys tab → create one.
//                    NOTE: this is the API key, NOT the SMTP key.)
//   SITE_URL        (https://ekrpt.com)  — already set if you did Cryptomus
//
// VERIFY JWT: OFF (same as your other functions on this project).
//
// CALL IT with JSON:
//   { type: "order_confirmed" | "payment_received" | "order_shipped",
//     to: "customer@email.com",
//     name: "Customer Name",
//     orderNumber: "EKRPT-2026-1234",
//     total: "₦510,000",        // optional, pre-formatted
//     items: "1× SPECTRE BE19000 ULTRA",  // optional
//     method: "PayPal",         // optional (payment_received)
//     tracking: "ABC123"        // optional (order_shipped)
//   }
// ════════════════════════════════════════════════════════════

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RED = "#e0202d";
const LOGO = "https://ekrpt.com/img/logo-ekrpt.png";
function shell(bodyHtml: string): string {
  return `<div style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e8ec;border-radius:16px;overflow:hidden">
      <tr><td align="center" style="background:#ffffff;padding:26px 28px 18px;border-bottom:1px solid #eef0f3">
        <span style="display:inline-block;background:#0c0e14;border-radius:10px;padding:12px 18px">
          <img src="${LOGO}" alt="EKRPT" height="30" style="height:30px;width:auto;display:block"/>
        </span>
      </td></tr>
      <tr><td style="padding:34px 30px 8px">${bodyHtml}</td></tr>
      <tr><td style="padding:22px 30px;border-top:1px solid #eef0f3">
        <p style="color:#9aa1ad;font-size:11px;margin:0">EKRPT Store · ekrpt.com · office@ekrpt.com</p>
      </td></tr>
    </table>
  </td></tr></table>
</div>`;
}

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:${RED};color:#fff;text-decoration:none;font-size:15px;font-weight:bold;padding:13px 30px;border-radius:8px">${label}</a>`;

function buildEmail(type: string, d: Record<string, string>, site: string) {
  const acct = `${site}/account/index.html`;
  if (type === "order_confirmed") {
    return {
      subject: `Order confirmed — ${d.orderNumber}`,
      html: shell(`
        <h1 style="color:#13151a;font-size:22px;margin:0 0 6px">Order confirmed ✓</h1>
        <p style="color:#5b6472;font-size:15px;line-height:1.6;margin:0 0 22px">Thanks ${d.name||'there'} — EKRPT Store has received your payment and your order is confirmed.</p>
        <table role="presentation" width="100%" style="background:#f7f8fa;border:1px solid #eef0f3;border-radius:10px;margin:0 0 22px"><tr><td style="padding:16px 18px">
          <p style="color:#9aa1ad;font-size:11px;letter-spacing:1px;margin:0 0 4px">ORDER NUMBER</p>
          <p style="color:#13151a;font-size:16px;font-weight:bold;margin:0 0 14px">${d.orderNumber||''}</p>
          ${d.items?`<p style="color:#9aa1ad;font-size:11px;letter-spacing:1px;margin:0 0 4px">ITEMS</p><p style="color:#3a4150;font-size:14px;line-height:1.6;margin:0 0 14px">${d.items}</p>`:''}
          ${d.total?`<p style="color:#9aa1ad;font-size:11px;letter-spacing:1px;margin:0 0 4px">TOTAL</p><p style="color:${RED};font-size:18px;font-weight:bold;margin:0">${d.total}</p>`:''}
        </td></tr></table>
        ${btn(acct,'View My Order')}`),
    };
  }
  if (type === "payment_received") {
    return {
      subject: `Payment received — ${d.orderNumber}`,
      html: shell(`
        <h1 style="color:#13151a;font-size:22px;margin:0 0 6px">Payment received</h1>
        <p style="color:#5b6472;font-size:15px;line-height:1.6;margin:0 0 22px">Hi ${d.name||'there'}, EKRPT Store has received your payment of <strong style="color:#13151a">${d.total||''}</strong>${d.method?` via ${d.method}`:''} for order ${d.orderNumber||''}. We're preparing it for dispatch.</p>
        ${btn(acct,'Track My Order')}`),
    };
  }
  if (type === "order_shipped") {
    return {
      subject: `Your order has shipped — ${d.orderNumber}`,
      html: shell(`
        <h1 style="color:#13151a;font-size:22px;margin:0 0 6px">Your order is on its way 🚀</h1>
        <p style="color:#5b6472;font-size:15px;line-height:1.6;margin:0 0 22px">Good news ${d.name||'there'} — order ${d.orderNumber||''} from EKRPT Store has shipped.</p>
        ${d.tracking?`<table role="presentation" width="100%" style="background:#f7f8fa;border:1px solid #eef0f3;border-radius:10px;margin:0 0 22px"><tr><td style="padding:16px 18px"><p style="color:#9aa1ad;font-size:11px;letter-spacing:1px;margin:0 0 4px">TRACKING</p><p style="color:#13151a;font-size:15px;font-weight:bold;margin:0">${d.tracking}</p></td></tr></table>`:''}
        ${btn(acct,'View Order')}`),
    };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

  try {
    const apiKey = Deno.env.get("BREVO_API_KEY");
    const site = Deno.env.get("SITE_URL") || "https://ekrpt.com";
    if (!apiKey) return json({ error: "BREVO_API_KEY not set" }, 500);

    const d = await req.json();
    if (!d.type || !d.to) return json({ error: "type and to are required" }, 400);

    const email = buildEmail(d.type, d, site);
    if (!email) return json({ error: `Unknown type '${d.type}'` }, 400);

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", "accept": "application/json" },
      body: JSON.stringify({
        sender: { name: "EKRPT Networking Labs", email: "noreply@ekrpt.com" },
        to: [{ email: d.to, name: d.name || undefined }],
        subject: email.subject,
        htmlContent: email.html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: "Brevo send failed", detail }, 502);
    }
    return json({ success: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

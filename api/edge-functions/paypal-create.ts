// ════════════════════════════════════════════════════════════
// EKRPT — Supabase Edge Function: paypal-create
// Creates a PayPal order server-side and returns its id.
//
// Frontend (js/payments.js) sends:  { amount, orderId, orderNumber }
// Frontend expects back:            { paypalOrderId }
//
// Secrets required (set in Supabase → Edge Functions → Secrets):
//   PAYPAL_CLIENT_ID
//   PAYPAL_SECRET
//   PAYPAL_ENV        = "sandbox" (for testing) or "live"
// ════════════════════════════════════════════════════════════

const PAYPAL_ENV = Deno.env.get("PAYPAL_ENV") || "sandbox";
const BASE = PAYPAL_ENV === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getAccessToken(): Promise<string> {
  const id = Deno.env.get("PAYPAL_CLIENT_ID");
  const secret = Deno.env.get("PAYPAL_SECRET");
  if (!id || !secret) throw new Error("PayPal credentials not configured");

  const auth = btoa(`${id}:${secret}`);
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "PayPal auth failed");
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { amount, orderNumber } = await req.json();
    if (!amount || Number(amount) <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const token = await getAccessToken();

    const res = await fetch(`${BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: orderNumber || undefined,
          amount: { currency_code: "USD", value: Number(amount).toFixed(2) },
        }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "PayPal order create failed", detail: data }), {
        status: 502, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ paypalOrderId: data.id }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

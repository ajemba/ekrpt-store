// ════════════════════════════════════════════════════════════
// EKRPT — Supabase Edge Function: cryptomus-create
// Creates a Cryptomus crypto invoice and returns its hosted pay URL.
//
// Frontend (js/payments.js → createCryptoInvoice) sends:
//   { amount, currency, orderId, orderNumber }
//     amount      = USD amount (string/number)
//     currency    = invoice currency, e.g. "USD" (payer picks the coin)
//     orderId     = EKRPT internal order UUID
//     orderNumber = EKRPT-YYYY-NNNN
// Frontend expects back:
//   { url, uuid, amount, currency, expiry }   (passed straight to the UI)
//
// Secrets required (Supabase → Edge Functions → Secrets):
//   CRYPTOMUS_MERCHANT_ID   (the merchant UUID from Cryptomus business profile)
//   CRYPTOMUS_API_KEY       (the PAYMENT api key — used for sign + webhook verify)
//   SITE_URL                (e.g. https://ekrpt.com — for return/callback links)
//
// Cryptomus auth: header  merchant: <id>,  sign: md5( base64(jsonBody) + API_KEY )
// Docs: https://doc.cryptomus.com/payments/creating-invoice
// ════════════════════════════════════════════════════════════

import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

const API_BASE = "https://api.cryptomus.com/v1/payment";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Cryptomus sign = md5( base64(jsonString) + API_KEY )
async function makeSign(jsonString: string, apiKey: string): Promise<string> {
  const b64 = btoa(jsonString);
  const buf = await crypto.subtle.digest("MD5", new TextEncoder().encode(b64 + apiKey));
  return encodeHex(new Uint8Array(buf));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const merchantId = Deno.env.get("CRYPTOMUS_MERCHANT_ID");
    const apiKey = Deno.env.get("CRYPTOMUS_API_KEY");
    const siteUrl = Deno.env.get("SITE_URL") || "https://ekrpt.com";
    if (!merchantId || !apiKey) {
      return new Response(JSON.stringify({ error: "Cryptomus credentials not configured" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // `amount` is a USD value (frontend converts NGN→USD via toUSD()).
    // `currency` here is the COIN the customer picked (USDT, BTC, ...).
    // We always PRICE the invoice in USD and let Cryptomus convert to the
    // chosen coin via to_currency — otherwise "300" would be read as
    // 300 of that coin instead of $300.
    const { amount, currency, orderId, orderNumber } = await req.json();
    if (!amount || Number(amount) <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Cryptomus order_id must be alphanumeric/underscore/dash, no spaces.
    // Use the EKRPT order number; fall back to the UUID. Keep it unique-ish.
    const cryptoOrderId = String(orderNumber || orderId || `EKRPT-${Date.now()}`)
      .replace(/[^A-Za-z0-9_-]/g, "-");

    const coin = (currency && String(currency).toUpperCase() !== "USD")
      ? String(currency).toUpperCase()
      : null; // null = let the payer choose any coin on the Cryptomus page

    const payload: Record<string, unknown> = {
      amount: Number(amount).toFixed(2),
      currency: "USD",
      order_id: cryptoOrderId,
      // Webhook that confirms payment server-side (this project's cryptomus-webhook fn):
      url_callback: `${Deno.env.get("SUPABASE_URL")}/functions/v1/cryptomus-webhook`,
      // Where the customer is sent back after paying:
      url_return: `${siteUrl}/account/index.html`,
      url_success: `${siteUrl}/account/index.html`,
      // Pass our internal UUID through so the webhook can find the order:
      additional_data: JSON.stringify({ ekrptOrderId: orderId, orderNumber }),
    };
    // If the customer pre-picked a coin, convert the USD price into it.
    if (coin) payload.to_currency = coin;

    const body = JSON.stringify(payload);
    const sign = await makeSign(body, apiKey);

    const res = await fetch(API_BASE, {
      method: "POST",
      headers: {
        "merchant": merchantId,
        "sign": sign,
        "Content-Type": "application/json",
      },
      body,
    });

    const data = await res.json();
    if (!res.ok || data.state !== 0 || !data.result) {
      return new Response(JSON.stringify({ error: "Cryptomus invoice create failed", detail: data }), {
        status: 502, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const r = data.result;
    return new Response(JSON.stringify({
      url: r.url,
      uuid: r.uuid,
      amount: r.amount,
      currency: r.currency,
      expiry: r.expired_at,
    }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

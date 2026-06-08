// ════════════════════════════════════════════════════════════
// EKRPT — Supabase Edge Function: paypal-capture
// Captures (finalizes) a PayPal order, then marks the EKRPT order paid.
//
// Frontend (js/payments.js) sends:  { paypalOrderId, ekrptOrderId }
// Frontend expects back:            { status: "COMPLETED", ... }
//
// Secrets required (Supabase → Edge Functions → Secrets):
//   PAYPAL_CLIENT_ID
//   PAYPAL_SECRET
//   PAYPAL_ENV                  = "sandbox" or "live"
//   SUPABASE_URL                (auto-provided by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY   (auto-provided by Supabase)
// ════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { paypalOrderId, ekrptOrderId } = await req.json();
    if (!paypalOrderId) {
      return new Response(JSON.stringify({ error: "Missing paypalOrderId" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const token = await getAccessToken();

    // Capture the PayPal order
    const capRes = await fetch(`${BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const capData = await capRes.json();

    if (!capRes.ok || capData.status !== "COMPLETED") {
      return new Response(JSON.stringify({ status: capData.status || "FAILED", detail: capData }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Mark the EKRPT order paid (service role bypasses RLS safely, server-side only)
    if (ekrptOrderId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      await supabase.from("orders").update({
        payment_status: "paid",
        status: "confirmed",
        payment_method: "paypal",
        updated_at: new Date().toISOString(),
      }).eq("id", ekrptOrderId);

      await supabase.from("order_events").insert({
        order_id: ekrptOrderId,
        status: "confirmed",
        note: "Payment received via PayPal",
      });

      // Send confirmation email (best-effort: never fail capture if email fails)
      try {
        const { data: ord } = await supabase
          .from("orders")
          .select("order_number, total, shipping_address")
          .eq("id", ekrptOrderId)
          .single();
        const ship = ord?.shipping_address || {};
        if (ord && ship.email) {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "payment_received",
              to: ship.email,
              name: ship.name || "there",
              orderNumber: ord.order_number,
              total: "₦" + Number(ord.total).toLocaleString(),
              method: "PayPal",
            }),
          });
        }
      } catch (_) { /* email is non-critical */ }
    }

    return new Response(JSON.stringify({ status: "COMPLETED", capture: capData }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// ════════════════════════════════════════════════════════════
// EKRPT — Supabase Edge Function: cryptomus-webhook
// Receives Cryptomus payment callbacks, verifies the signature,
// and marks the matching EKRPT order paid. (Crypto payments confirm
// ASYNCHRONOUSLY — unlike PayPal there is no synchronous capture.)
//
// Cryptomus POSTs JSON like:
//   { type, uuid, order_id, amount, payment_amount, status,
//     additional_data, sign, ... }
// The `sign` field is INSIDE the body. Verification algorithm:
//   1. remove `sign` from the object
//   2. recompute md5( base64(json_without_sign) + API_KEY )
//   3. compare to the received sign
//
// Statuses that mean "money received":  paid, paid_over
// Docs: https://doc.cryptomus.com/merchant-api/payments/webhook
//
// Secrets required (Supabase → Edge Functions → Secrets):
//   CRYPTOMUS_API_KEY            (PAYMENT api key — same one used to create)
//   SUPABASE_URL                 (auto-provided by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY    (auto-provided by Supabase)
//
// IMPORTANT: this function is called by Cryptomus's servers, NOT the
// browser, so it does NOT use the publishable key and must have
// "Verify JWT" turned OFF (same as the PayPal functions).
// ════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

async function makeSign(jsonString: string, apiKey: string): Promise<string> {
  const b64 = btoa(jsonString);
  const buf = await crypto.subtle.digest("MD5", new TextEncoder().encode(b64 + apiKey));
  return encodeHex(new Uint8Array(buf));
}

Deno.serve(async (req) => {
  // Cryptomus only ever POSTs here.
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const apiKey = Deno.env.get("CRYPTOMUS_API_KEY");
    if (!apiKey) return new Response("Not configured", { status: 500 });

    const payload = await req.json();
    const receivedSign = payload.sign;
    if (!receivedSign) return new Response("Missing sign", { status: 400 });

    // Recompute sign over the body WITHOUT the sign field.
    const { sign: _omit, ...rest } = payload;
    // Cryptomus signs the exact JSON string of the data minus `sign`.
    const expected = await makeSign(JSON.stringify(rest), apiKey);

    if (expected !== receivedSign) {
      // Bad signature — could be spoofed. Reject and do nothing.
      return new Response("Invalid sign", { status: 403 });
    }

    const status = payload.status; // paid, paid_over, fail, cancel, ...
    const isPaid = status === "paid" || status === "paid_over";

    // Find our internal order id. We passed it through additional_data on create.
    let ekrptOrderId: string | null = null;
    let orderNumber: string | null = null;
    try {
      const add = typeof payload.additional_data === "string"
        ? JSON.parse(payload.additional_data)
        : payload.additional_data;
      ekrptOrderId = add?.ekrptOrderId || null;
      orderNumber = add?.orderNumber || null;
    } catch (_) { /* additional_data not JSON — fall back below */ }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve the order: prefer the UUID, then the order_number Cryptomus echoes back.
    let targetId = ekrptOrderId;
    if (!targetId && (orderNumber || payload.order_id)) {
      const num = orderNumber || payload.order_id;
      const { data: found } = await supabase
        .from("orders").select("id").eq("order_number", num).maybeSingle();
      targetId = found?.id || null;
    }

    if (isPaid && targetId) {
      await supabase.from("orders").update({
        payment_status: "paid",
        status: "confirmed",
        payment_method: "cryptomus",
        updated_at: new Date().toISOString(),
      }).eq("id", targetId);

      await supabase.from("order_events").insert({
        order_id: targetId,
        status: "confirmed",
        note: `Payment received via Cryptomus (${status})`,
      });

      // Send confirmation email (best-effort: never fail the webhook if email fails)
      try {
        const { data: ord } = await supabase
          .from("orders")
          .select("order_number, total, shipping_address")
          .eq("id", targetId)
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
              method: "Cryptomus",
            }),
          });
        }
      } catch (_) { /* email is non-critical */ }
    }

    // Cryptomus expects a 200 to stop retrying. Always ack a verified webhook.
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});

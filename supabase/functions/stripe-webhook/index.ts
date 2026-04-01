// Supabase Edge Function: stripe-webhook
// Handles Stripe webhook events (checkout.session.completed)
// to add credits, log transactions, and top up Twilio balance.
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Required secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
};

const TWILIO_COST_PER_SMS = 0.0079;
const TWILIO_BUFFER_PERCENT = 0.10;

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const parts: Record<string, string> = {};
  for (const item of signature.split(",")) {
    const [key, value] = item.split("=");
    parts[key.trim()] = value;
  }

  const timestamp = parts["t"];
  const v1Signature = parts["v1"];
  if (!timestamp || !v1Signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );
  const expectedSig = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSig === v1Signature;
}

async function topUpTwilio(credits: number, clientId: string, supabase: ReturnType<typeof createClient>): Promise<void> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) {
    console.error("Twilio credentials not configured, skipping top-up");
    return;
  }

  const baseCost = credits * TWILIO_COST_PER_SMS;
  const topUpAmount = baseCost * (1 + TWILIO_BUFFER_PERCENT);
  const topUpRounded = Math.ceil(topUpAmount * 100) / 100;

  const auth = btoa(`${sid}:${token}`);

  async function attemptTopUp(): Promise<boolean> {
    try {
      // Use Twilio Balance top-up endpoint
      const params = new URLSearchParams();
      params.set("Amount", topUpRounded.toFixed(2));
      params.set("Currency", "USD");

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Twilio top-up failed:", err);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Twilio top-up error:", err);
      return false;
    }
  }

  let success = await attemptTopUp();

  if (!success) {
    // Flag as pending in credit_transactions
    await supabase.from("credit_transactions").insert({
      client_id: clientId,
      amount: 0,
      description: `Twilio top-up pending: $${topUpRounded.toFixed(2)} for ${credits} credits — retry scheduled`,
      bundle_type: "twilio_topup",
      cost_per_credit: TWILIO_COST_PER_SMS,
    });

    // Retry once after 60 seconds
    await new Promise((resolve) => setTimeout(resolve, 60000));
    success = await attemptTopUp();

    if (!success) {
      await supabase.from("credit_transactions").insert({
        client_id: clientId,
        amount: 0,
        description: `Twilio top-up FAILED after retry: $${topUpRounded.toFixed(2)} for ${credits} credits — manual action needed`,
        bundle_type: "twilio_topup",
        cost_per_credit: TWILIO_COST_PER_SMS,
      });
      console.error(`Twilio top-up failed after retry for ${clientId}`);
      return;
    }
  }

  // Log successful Twilio top-up
  await supabase.from("credit_transactions").insert({
    client_id: clientId,
    amount: 0,
    description: `Twilio auto top-up: $${topUpRounded.toFixed(2)} (${credits} credits x $${TWILIO_COST_PER_SMS} + 10% buffer)`,
    bundle_type: "twilio_topup",
    cost_per_credit: TWILIO_COST_PER_SMS,
  });

  console.log(`Twilio topped up $${topUpRounded.toFixed(2)} for ${clientId}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const rawBody = await req.text();

  if (webhookSecret) {
    const signature = req.headers.get("Stripe-Signature") || "";
    const valid = await verifyStripeSignature(rawBody, signature, webhookSecret);
    if (!valid) {
      console.error("Invalid Stripe webhook signature");
      return new Response("Invalid signature", { status: 400 });
    }
  }

  try {
    const event = JSON.parse(rawBody);

    if (event.type !== "checkout.session.completed") {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const session = event.data.object;
    const clientId = session.metadata?.client_id;
    const credits = parseInt(session.metadata?.credits || "0", 10);
    const bundleId = session.metadata?.bundle_id || "unknown";
    const costPerCredit = parseFloat(session.metadata?.cost_per_credit || "0");

    if (!clientId || credits <= 0) {
      console.error("Missing metadata in checkout session:", session.id);
      return new Response("Missing metadata", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get current balance
    const { data: creditRow } = await supabase
      .from("credits")
      .select("balance")
      .eq("client_id", clientId)
      .single();

    if (creditRow) {
      await supabase
        .from("credits")
        .update({ balance: creditRow.balance + credits })
        .eq("client_id", clientId);
    } else {
      await supabase
        .from("credits")
        .insert({ client_id: clientId, balance: credits });
    }

    // Log the transaction with bundle_type and cost_per_credit
    const amountPaid = (session.amount_total / 100).toFixed(2);
    await supabase.from("credit_transactions").insert({
      client_id: clientId,
      amount: credits,
      description: `Purchased ${credits} credits (${bundleId} bundle) — $${amountPaid}`,
      bundle_type: bundleId,
      cost_per_credit: costPerCredit || null,
    });

    console.log(`Added ${credits} credits to ${clientId} (session: ${session.id})`);

    // Trigger Twilio top-up in the background
    topUpTwilio(credits, clientId, supabase).catch((err) =>
      console.error("Twilio top-up background error:", err),
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook error:", err);
    return new Response("Webhook processing error", { status: 500 });
  }
});

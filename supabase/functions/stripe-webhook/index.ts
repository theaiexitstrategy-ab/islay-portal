// Supabase Edge Function: stripe-webhook
// Handles Stripe webhook events (checkout.session.completed)
// to add credits to a client's balance.
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Required secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
};

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  // Parse the Stripe-Signature header
  const parts: Record<string, string> = {};
  for (const item of signature.split(",")) {
    const [key, value] = item.split("=");
    parts[key.trim()] = value;
  }

  const timestamp = parts["t"];
  const v1Signature = parts["v1"];
  if (!timestamp || !v1Signature) return false;

  // Compute expected signature
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const rawBody = await req.text();

  // Verify webhook signature if secret is configured
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
      // Acknowledge but ignore other events
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const session = event.data.object;
    const clientId = session.metadata?.client_id;
    const credits = parseInt(session.metadata?.credits || "0", 10);
    const bundleId = session.metadata?.bundle_id || "unknown";

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
      // Update existing balance
      await supabase
        .from("credits")
        .update({ balance: creditRow.balance + credits })
        .eq("client_id", clientId);
    } else {
      // Create new credits row
      await supabase
        .from("credits")
        .insert({ client_id: clientId, balance: credits });
    }

    // Log the transaction
    const amountPaid = (session.amount_total / 100).toFixed(2);
    await supabase
      .from("credit_transactions")
      .insert({
        client_id: clientId,
        amount: credits,
        description: `Purchased ${credits} credits (${bundleId} bundle) — $${amountPaid}`,
      });

    console.log(`Added ${credits} credits to ${clientId} (session: ${session.id})`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook error:", err);
    return new Response("Webhook processing error", { status: 500 });
  }
});

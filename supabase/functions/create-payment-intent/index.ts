// Supabase Edge Function: create-payment-intent
// Creates a Stripe PaymentIntent for credit package purchases.
// Returns { clientSecret } for Stripe Elements integration.
//
// Deploy: supabase functions deploy create-payment-intent --no-verify-jwt
// Required secrets: STRIPE_SECRET_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const PACKAGES: Record<
  string,
  { name: string; amount_cents: number; credits: number }
> = {
  "500": { name: "500 Credits", amount_cents: 2500, credits: 500 },
  "1000": { name: "1,000 Credits", amount_cents: 4500, credits: 1000 },
  "2500": { name: "2,500 Credits", amount_cents: 10000, credits: 2500 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { client_id, package_id } = await req.json();

    const pkg = PACKAGES[package_id];
    if (!pkg) {
      return new Response(
        JSON.stringify({
          error:
            "Invalid package_id. Use: 500, 1000, or 2500",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up or create Stripe Customer
    const { data: existingBilling } = await supabase
      .from("billing_records")
      .select("stripe_customer_id")
      .eq("client_id", client_id || "islay_studios")
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .single();

    let stripeCustomerId = existingBilling?.stripe_customer_id;

    if (!stripeCustomerId) {
      // Create a new Stripe Customer
      const customerParams = new URLSearchParams();
      customerParams.set("metadata[client_id]", client_id || "islay_studios");
      customerParams.set("description", `GoElev8 Client: ${client_id || "islay_studios"}`);

      const customerRes = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: customerParams.toString(),
      });

      const customer = await customerRes.json();
      if (!customerRes.ok) {
        return new Response(
          JSON.stringify({ error: customer.error?.message || "Failed to create customer" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      stripeCustomerId = customer.id;
    }

    // Create PaymentIntent
    const piParams = new URLSearchParams();
    piParams.set("amount", String(pkg.amount_cents));
    piParams.set("currency", "usd");
    piParams.set("customer", stripeCustomerId!);
    piParams.set("description", `Credit reload: ${pkg.name}`);
    piParams.set("metadata[client_id]", client_id || "islay_studios");
    piParams.set("metadata[package_id]", package_id);
    piParams.set("metadata[credits]", String(pkg.credits));

    const piRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: piParams.toString(),
    });

    const pi = await piRes.json();

    if (!piRes.ok) {
      return new Response(
        JSON.stringify({ error: pi.error?.message || "Failed to create payment intent" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Insert pending billing record
    await supabase.from("billing_records").insert({
      client_id: client_id || "islay_studios",
      stripe_customer_id: stripeCustomerId,
      stripe_payment_intent_id: pi.id,
      amount_cents: pkg.amount_cents,
      credits_purchased: pkg.credits,
      status: "pending",
      package: pkg.name,
    });

    return new Response(
      JSON.stringify({ clientSecret: pi.client_secret }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("create-payment-intent error:", err);
    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

// Supabase Edge Function: stripe-checkout
// Creates a Stripe Checkout Session for credit bundle purchases.
//
// Deploy: supabase functions deploy stripe-checkout --no-verify-jwt
// Required secrets: STRIPE_SECRET_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const BUNDLES: Record<string, { name: string; price: number; credits: number; costPerCredit: number }> = {
  starter: { name: "Starter — 250 Credits",   price: 2500,  credits: 250,  costPerCredit: 0.10 },
  growth:  { name: "Growth — 625 Credits",    price: 5000,  credits: 625,  costPerCredit: 0.08 },
  pro:     { name: "Pro — 2,000 Credits",     price: 10000, credits: 2000, costPerCredit: 0.05 },
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
    const { bundle_id, client_id, success_url, cancel_url } = await req.json();

    const bundle = BUNDLES[bundle_id];
    if (!bundle) {
      return new Response(
        JSON.stringify({ error: "Invalid bundle_id. Use: starter, growth, or pro" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create Stripe Checkout Session via API
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", success_url || "https://portal.islaystudiosllc.com/credits?success=true");
    params.set("cancel_url", cancel_url || "https://portal.islaystudiosllc.com/credits?cancelled=true");
    params.set("line_items[0][price_data][currency]", "usd");
    params.set("line_items[0][price_data][product_data][name]", bundle.name);
    params.set("line_items[0][price_data][unit_amount]", String(bundle.price));
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[client_id]", client_id || "islay_studios");
    params.set("metadata[bundle_id]", bundle_id);
    params.set("metadata[credits]", String(bundle.credits));
    params.set("metadata[cost_per_credit]", String(bundle.costPerCredit));

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      console.error("Stripe error:", session);
      return new Response(
        JSON.stringify({ error: session.error?.message || "Stripe error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("stripe-checkout error:", err);
    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

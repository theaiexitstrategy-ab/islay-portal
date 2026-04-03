// Supabase Edge Function: credit-fulfillment
// Called after successful Stripe payment to:
//   1. Add purchased credits to client_credits.balance
//   2. Insert positive credit_transactions row
//   3. Insert billing_records row with status = 'paid'
//
// Deploy: supabase functions deploy credit-fulfillment --no-verify-jwt
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    const { client_id, credits_purchased, package_name, payment_intent_id, amount_cents } =
      await req.json();

    if (!client_id || !credits_purchased || credits_purchased <= 0) {
      return new Response(
        JSON.stringify({ error: "client_id and credits_purchased are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Add credits to balance
    const { data: creditRow } = await supabase
      .from("credits")
      .select("balance")
      .eq("client_id", client_id)
      .single();

    if (creditRow) {
      await supabase
        .from("credits")
        .update({ balance: creditRow.balance + credits_purchased })
        .eq("client_id", client_id);
    } else {
      await supabase
        .from("credits")
        .insert({ client_id, balance: credits_purchased, account_status: "active" });
    }

    // 2. Insert positive credit_transactions row
    await supabase.from("credit_transactions").insert({
      client_id,
      amount: credits_purchased,
      description: `Credit reload \u2014 ${package_name || credits_purchased + " credits"}`,
    });

    // 3. Update billing_records to paid
    if (payment_intent_id) {
      await supabase
        .from("billing_records")
        .update({ status: "paid" })
        .eq("stripe_payment_intent_id", payment_intent_id)
        .eq("client_id", client_id);
    } else {
      // Insert new billing record if no existing one
      await supabase.from("billing_records").insert({
        client_id,
        amount_cents: amount_cents || 0,
        credits_purchased,
        status: "paid",
        package: package_name || null,
      });
    }

    console.log(
      `Credit fulfillment: added ${credits_purchased} credits to ${client_id}`,
    );

    return new Response(
      JSON.stringify({ success: true, credits_added: credits_purchased }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("credit-fulfillment error:", err);
    return new Response(
      JSON.stringify({ error: "Fulfillment failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

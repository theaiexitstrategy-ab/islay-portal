// Supabase Edge Function: grant-trial-credits
// Called when a new GoElev8 client account is provisioned.
// Grants 20 complimentary trial credits with 14-day expiry.
//
// 20 credits = enough to send a test blast and verify the system works,
// but not enough to run real campaigns — driving upgrade conversion.
//
// NOTE: iSlay Studios is already seeded as active with 500 credits.
//       Do NOT apply trial logic to islay_studios.
//
// Deploy: supabase functions deploy grant-trial-credits --no-verify-jwt
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const TRIAL_CREDITS = 20;
const TRIAL_DAYS = 14;

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
    const { client_id } = await req.json();

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: "client_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Safety check: never apply trial to islay_studios
    if (client_id === "islay_studios") {
      return new Response(
        JSON.stringify({ error: "Cannot apply trial to existing active client" }),
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

    const trialExpiresAt = new Date(
      Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Check if client already exists
    const { data: existing } = await supabase
      .from("credits")
      .select("id, account_status")
      .eq("client_id", client_id)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Client already has a credits record" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create credits record with trial status
    await supabase.from("credits").insert({
      client_id,
      balance: TRIAL_CREDITS,
      account_status: "trial",
      trial_credits_granted: TRIAL_CREDITS,
      trial_expires_at: trialExpiresAt,
    });

    // Log the trial credit grant
    await supabase.from("credit_transactions").insert({
      client_id,
      amount: TRIAL_CREDITS,
      description: `GoElev8 trial \u2014 ${TRIAL_CREDITS} complimentary credits`,
    });

    // Create default client_settings
    await supabase.from("client_settings").insert({
      client_id,
      studio_name: client_id,
    });

    console.log(
      `Trial credits granted: ${TRIAL_CREDITS} credits to ${client_id}, expires ${trialExpiresAt}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        client_id,
        credits_granted: TRIAL_CREDITS,
        trial_expires_at: trialExpiresAt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("grant-trial-credits error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to grant trial credits" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

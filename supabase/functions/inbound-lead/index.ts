// Supabase Edge Function: inbound-lead
// Receives POST from Make.com webhook and writes to leads table.
//
// Deploy: supabase functions deploy inbound-lead --no-verify-jwt
// URL:    https://uouoczmxigizkqszagdl.supabase.co/functions/v1/inbound-lead

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
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
    const body = await req.json();

    // Map incoming webhook fields to our leads table columns.
    // Make.com may send fields with various naming conventions —
    // we normalize them here.
    const lead = {
      full_name: body.full_name || body.fullName || body.name || null,
      phone: body.phone || body.phone_number || body.phoneNumber || null,
      email: body.email || null,
      lead_source: body.lead_source || body.leadSource || body.source || null,
      artist_selected:
        body.artist_selected ||
        body.artistSelected ||
        body.artist ||
        null,
      promo_code: body.promo_code || body.promoCode || "SLAY10",
      booking_platform:
        body.booking_platform || body.bookingPlatform || null,
      booking_url: body.booking_url || body.bookingUrl || null,
      notes: body.notes || null,
      lead_status: "New",
      date_entered: new Date().toISOString(),
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("leads")
      .insert(lead)
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

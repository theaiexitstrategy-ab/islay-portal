// Supabase Edge Function: inbound-lead
// Receives POST from Make.com webhook, writes to leads table,
// then sends a welcome SMS via Twilio with promo code + booking link.
//
// Deploy: supabase functions deploy inbound-lead --no-verify-jwt
// URL:    https://uouoczmxigizkqszagdl.supabase.co/functions/v1/inbound-lead
//
// Required secrets (set via supabase secrets set):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const DEFAULT_BOOKING_URL = "www.islaystudiosllc.com";

async function sendSMS(to: string, body: string): Promise<boolean> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const from = Deno.env.get("TWILIO_PHONE_NUMBER")!;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = btoa(`${sid}:${token}`);

  const params = new URLSearchParams();
  params.set("To", to);
  params.set("From", from);
  params.set("Body", body);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Twilio error:", err.message || err);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Twilio fetch error:", err);
    return false;
  }
}

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
    // Normalize phone to E.164 format (+1XXXXXXXXXX)
    let rawPhone: string | null =
      body.phone || body.phone_number || body.phoneNumber || null;
    if (rawPhone) {
      rawPhone = rawPhone.replace(/[\s\-().]/g, ""); // strip formatting
      if (!rawPhone.startsWith("+")) {
        rawPhone = "+1" + rawPhone; // assume US if no country code
      }
    }

    const lead = {
      full_name: body.full_name || body.fullName || body.name || null,
      phone: rawPhone,
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
      client_id: body.client_id || body.clientId || "islay_studios",
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

    // --- Send welcome SMS ---
    let smsDelivered = false;

    if (lead.phone) {
      // Look up booking URL from artists table
      let bookingUrl = DEFAULT_BOOKING_URL;

      if (lead.artist_selected) {
        const { data: artist } = await supabase
          .from("artists")
          .select("booking_url")
          .eq("name", lead.artist_selected)
          .single();

        if (artist?.booking_url) {
          bookingUrl = artist.booking_url;
        }
      }

      // Extract first name from full_name
      const firstName = lead.full_name
        ? lead.full_name.split(" ")[0]
        : "there";

      const smsBody =
        `Hey ${firstName}, thanks for connecting with iSlay Studios! ` +
        `Here's your $10 off promo code: SLAY10. ` +
        `Book here: ${bookingUrl}`;

      smsDelivered = await sendSMS(lead.phone, smsBody);

      // Mark sms_delivered on the lead record
      await supabase
        .from("leads")
        .update({ sms_delivered: smsDelivered })
        .eq("id", data.id);
    }

    return new Response(
      JSON.stringify({ success: true, id: data.id, sms_delivered: smsDelivered }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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

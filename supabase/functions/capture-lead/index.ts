// Supabase Edge Function: capture-lead
// Receives POST from islaystudiosllc.com website lead-capture form,
// upserts into leads table, sends welcome SMS via Twilio (using credits),
// and returns { success, lead_id }.
//
// Deploy: supabase functions deploy capture-lead --no-verify-jwt
// URL:    https://bnkoqybkmwtrlorhowyv.supabase.co/functions/v1/capture-lead
//
// Required secrets (set via supabase secrets set):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://islaystudiosllc.com",
  "https://www.islaystudiosllc.com",
  "http://localhost:3000",
];

function corsHeaders(origin?: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

const DEFAULT_BOOKING_URL = "https://www.islaystudiosllc.com";

// ---------------------------------------------------------------------------
// Twilio SMS helper (mirrors inbound-lead pattern)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    // -- Validate client_id ------------------------------------------------
    const clientId = body.client_id;
    if (clientId !== "islay_studios") {
      return new Response(
        JSON.stringify({ error: "Invalid client_id" }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // -- Validate required fields ------------------------------------------
    if (!body.name || !body.phone) {
      return new Response(
        JSON.stringify({ error: "name and phone are required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // -- Normalise phone to E.164 ------------------------------------------
    let phone = body.phone.replace(/[\s\-().]/g, "");
    if (!phone.startsWith("+")) {
      phone = "+1" + phone;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // -- Dedup: skip if same phone+client created in the last 24 h ---------
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("client_id", clientId)
      .eq("phone", phone)
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
      .limit(1)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, lead_id: existing.id, duplicate: true }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // -- Build lead record -------------------------------------------------
    const bookingUrl = body.booking_url || DEFAULT_BOOKING_URL;
    const lead = {
      full_name: body.name,
      phone,
      artist_selected: body.matched_artist || null,
      booking_url: bookingUrl,
      client_id: clientId,
      lead_source: "website",
      lead_status: "New",
      promo_code: "SLAY10",
      date_entered: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("leads")
      .insert(lead)
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const leadId = data.id;

    // -- SMS automation (credit-gated, same pattern as inbound-lead) -------
    let smsStatus: string | null = null;

    const { data: creditRow } = await supabase
      .from("credits")
      .select("balance")
      .eq("client_id", clientId)
      .single();

    const balance = creditRow?.balance ?? 0;

    if (balance <= 0) {
      smsStatus = "failed_no_credits";
      await supabase
        .from("leads")
        .update({ sms_delivered: false, sms_status: "failed_no_credits" })
        .eq("id", leadId);
    } else {
      // Resolve artist-specific booking URL if available
      let artistBookingUrl = bookingUrl;
      if (lead.artist_selected) {
        const { data: artist } = await supabase
          .from("artists")
          .select("booking_url")
          .eq("name", lead.artist_selected)
          .single();
        if (artist?.booking_url) {
          artistBookingUrl = artist.booking_url;
        }
      }

      const firstName = body.name.split(" ")[0] || "there";
      const smsBody =
        `Hey ${firstName}, thanks for connecting with iSlay Studios! ` +
        `Here's your $10 off promo code: SLAY10. ` +
        `Book here: ${artistBookingUrl}`;

      const smsDelivered = await sendSMS(phone, smsBody);
      smsStatus = smsDelivered ? "sent" : "failed";

      if (smsDelivered) {
        const newBalance = balance - 1;

        await supabase
          .from("credits")
          .update({ balance: newBalance })
          .eq("client_id", clientId);

        await supabase.from("credit_transactions").insert({
          client_id: clientId,
          amount: -1,
          description: `Website lead SMS: ${body.name}`,
          lead_id: leadId,
        });
      }

      await supabase
        .from("leads")
        .update({
          sms_delivered: smsStatus === "sent",
          sms_status: smsStatus,
        })
        .eq("id", leadId);
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: leadId }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("capture-lead error:", err);
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } },
    );
  }
});

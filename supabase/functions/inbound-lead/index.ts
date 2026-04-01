// Supabase Edge Function: inbound-lead
// Receives POST from Make.com webhook, writes to leads table,
// checks SMS credit balance, sends welcome SMS via Twilio,
// and triggers auto-reload if threshold is hit.
//
// Deploy: supabase functions deploy inbound-lead --no-verify-jwt
// URL:    https://uouoczmxigizkqszagdl.supabase.co/functions/v1/inbound-lead
//
// Required secrets (set via supabase secrets set):
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
//   STRIPE_SECRET_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const DEFAULT_BOOKING_URL = "https://www.islaystudiosllc.com";

const BUNDLES: Record<string, { price: number; credits: number; costPerCredit: number }> = {
  starter: { price: 2500,  credits: 250,  costPerCredit: 0.10 },
  growth:  { price: 5000,  credits: 625,  costPerCredit: 0.08 },
  pro:     { price: 10000, credits: 1666, costPerCredit: 0.06 },
};

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

async function triggerAutoReload(
  clientId: string,
  currentBalance: number,
  supabase: ReturnType<typeof createClient>,
): Promise<void> {
  // Check auto-reload settings
  const { data: settings } = await supabase
    .from("auto_reload")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (!settings?.enabled || !settings.stripe_payment_method_id) return;
  if (currentBalance > settings.threshold) return;

  const bundle = BUNDLES[settings.bundle_type];
  if (!bundle) return;

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    console.error("STRIPE_SECRET_KEY not set, cannot auto-reload");
    return;
  }

  try {
    // Create a PaymentIntent with the saved payment method
    const params = new URLSearchParams();
    params.set("amount", String(bundle.price));
    params.set("currency", "usd");
    params.set("payment_method", settings.stripe_payment_method_id);
    params.set("confirm", "true");
    params.set("off_session", "true");
    params.set("description", `Auto-reload: ${settings.bundle_type} bundle for ${clientId}`);
    params.set("metadata[client_id]", clientId);
    params.set("metadata[bundle_id]", settings.bundle_type);
    params.set("metadata[credits]", String(bundle.credits));
    params.set("metadata[auto_reload]", "true");

    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const pi = await res.json();

    if (!res.ok || pi.status !== "succeeded") {
      console.error("Auto-reload Stripe charge failed:", pi.error?.message || pi.status);
      await supabase.from("credit_transactions").insert({
        client_id: clientId,
        amount: 0,
        description: `Auto-reload FAILED: ${settings.bundle_type} bundle — ${pi.error?.message || "charge not succeeded"}`,
        bundle_type: settings.bundle_type,
      });
      return;
    }

    // Add credits to balance
    const { data: creditRow } = await supabase
      .from("credits")
      .select("balance")
      .eq("client_id", clientId)
      .single();

    const newBalance = (creditRow?.balance ?? 0) + bundle.credits;

    await supabase
      .from("credits")
      .update({ balance: newBalance })
      .eq("client_id", clientId);

    // Log the transaction
    const amountPaid = (bundle.price / 100).toFixed(2);
    await supabase.from("credit_transactions").insert({
      client_id: clientId,
      amount: bundle.credits,
      description: `Auto-reload: ${bundle.credits} credits (${settings.bundle_type} bundle) — $${amountPaid}`,
      bundle_type: settings.bundle_type,
      cost_per_credit: bundle.costPerCredit,
    });

    // Send SMS notification to client about auto-reload
    const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
    // Look up a notification number for the client (use studio owner's phone if available)
    // For now, log the notification — in production, store a notification_phone on auto_reload
    console.log(
      `Auto-reload fired for ${clientId}: charged $${amountPaid}, added ${bundle.credits} credits. New balance: ${newBalance}`,
    );

  } catch (err) {
    console.error("Auto-reload error:", err);
  }
}

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
    const body = await req.json();

    let rawPhone: string | null =
      body.phone || body.phone_number || body.phoneNumber || null;
    if (rawPhone) {
      rawPhone = rawPhone.replace(/[\s\-().]/g, "");
      if (!rawPhone.startsWith("+")) {
        rawPhone = "+1" + rawPhone;
      }
    }

    const clientId = body.client_id || body.clientId || "islay_studios";

    const lead = {
      full_name: body.full_name || body.fullName || body.name || null,
      phone: rawPhone,
      email: body.email || null,
      lead_source: body.lead_source || body.leadSource || body.source || null,
      artist_selected:
        body.artist_selected || body.artistSelected || body.artist || null,
      promo_code: body.promo_code || body.promoCode || "SLAY10",
      booking_platform:
        body.booking_platform || body.bookingPlatform || null,
      booking_url: body.booking_url || body.bookingUrl || null,
      notes: body.notes || null,
      client_id: clientId,
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

    // --- Check credit balance before sending SMS ---
    let smsDelivered = false;
    let smsStatus: string | null = null;

    if (lead.phone) {
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
          .eq("id", data.id);

        console.log(`SMS skipped for lead ${data.id}: no credits remaining for client ${clientId}`);
      } else {
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

        const firstName = lead.full_name
          ? lead.full_name.split(" ")[0]
          : "there";

        const smsBody =
          `Hey ${firstName}, thanks for connecting with iSlay Studios! ` +
          `Here's your $10 off promo code: SLAY10. ` +
          `Book here: ${bookingUrl}`;

        smsDelivered = await sendSMS(lead.phone, smsBody);
        smsStatus = smsDelivered ? "sent" : "failed";

        if (smsDelivered) {
          const newBalance = balance - 1;

          // Deduct 1 credit
          await supabase
            .from("credits")
            .update({ balance: newBalance })
            .eq("client_id", clientId);

          // Log the transaction
          await supabase.from("credit_transactions").insert({
            client_id: clientId,
            amount: -1,
            description: `SMS sent to lead: ${lead.full_name || lead.phone}`,
            lead_id: data.id,
          });

          // Check auto-reload threshold in background
          triggerAutoReload(clientId, newBalance, supabase).catch((err) =>
            console.error("Auto-reload check error:", err),
          );
        }

        await supabase
          .from("leads")
          .update({ sms_delivered: smsDelivered, sms_status: smsStatus })
          .eq("id", data.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: data.id,
        sms_delivered: smsDelivered,
        sms_status: smsStatus,
      }),
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

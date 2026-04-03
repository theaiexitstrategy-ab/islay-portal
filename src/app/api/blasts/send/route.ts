import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";
import { checkAndDeductCredits } from "@/lib/credits";
import type { Lead } from "@/types/database";

const CLIENT_ID = "islay_studios";

export async function POST(request: NextRequest) {
  try {
    const { name, message, promoCode, segment, artistFilter, dateFrom, dateTo, excludeIds } =
      await request.json();

    const supabase = getSupabaseAdmin();

    // Build query based on segment
    let query = supabase
      .from("leads")
      .select("*")
      .eq("client_id", CLIENT_ID);

    switch (segment) {
      case "first_timers":
        query = query.eq("booking_confirmed", false);
        break;
      case "returning":
        query = query.eq("booking_confirmed", true);
        break;
      case "no_shows":
        query = query.eq("lead_status", "No Show");
        break;
      case "by_artist":
        if (artistFilter) query = query.eq("artist_selected", artistFilter);
        break;
      // "all" — no filter
    }

    // Date range filters
    if (dateFrom) {
      query = query.gte("date_entered", dateFrom);
    }
    if (dateTo) {
      query = query.lte("date_entered", dateTo);
    }

    // Promo code filter
    if (promoCode) {
      // Filter leads who used this promo code (optional)
    }

    const { data: leads, error } = await query;
    if (error) throw error;

    // Filter to leads with phone numbers, exclude deselected contacts
    const excludeSet = new Set(excludeIds || []);
    const recipients = ((leads as Lead[]) || []).filter(
      (l) => !!l.phone && !excludeSet.has(l.id),
    );

    if (recipients.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, error: "No recipients with phone numbers" });
    }

    // CREDIT GATE: Reserve full batch cost upfront before sending any messages
    try {
      await checkAndDeductCredits(CLIENT_ID, recipients.length);
    } catch (creditError) {
      return NextResponse.json(
        { error: creditError instanceof Error ? creditError.message : "Insufficient credits" },
        { status: 402 },
      );
    }

    let finalMessage = message;
    if (promoCode) {
      finalMessage += `\n\nUse code: ${promoCode}`;
    }

    let sent = 0;
    let failed = 0;

    for (const lead of recipients) {
      const result = await sendSMS(lead.phone!, finalMessage);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    // Create blast record
    const { error: insertError } = await supabase.from("blasts").insert({
      blast_name: name,
      message_body: message,
      sent_at: new Date().toISOString(),
      total_recipients: recipients.length,
      delivered_count: sent,
      failed_count: failed,
      promo_code: promoCode || null,
      target_segment: segment,
      artist_filter: segment === "by_artist" ? artistFilter : null,
      status: "Sent",
    });

    if (insertError) console.error("Failed to record blast:", insertError);

    return NextResponse.json({ sent, failed });
  } catch (error) {
    console.error("Failed to send blast:", error);
    return NextResponse.json(
      { error: "Failed to send blast" },
      { status: 500 },
    );
  }
}

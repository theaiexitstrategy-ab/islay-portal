import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sendSMS } from "@/lib/twilio";
import type { Lead } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    const { name, message, promoCode, segment, artistFilter } =
      await request.json();

    const supabase = getSupabaseAdmin();

    // Build query based on segment
    let query = supabase.from("leads").select("*");

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
        query = query.eq("artist_selected", artistFilter);
        break;
      // "all" — no filter
    }

    const { data: leads, error } = await query;
    if (error) throw error;

    let finalMessage = message;
    if (promoCode) {
      finalMessage += `\n\nUse code: ${promoCode}`;
    }

    let sent = 0;
    let failed = 0;

    for (const lead of (leads as Lead[]) || []) {
      if (!lead.phone) {
        failed++;
        continue;
      }
      const result = await sendSMS(lead.phone, finalMessage);
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
      total_recipients: leads?.length ?? 0,
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

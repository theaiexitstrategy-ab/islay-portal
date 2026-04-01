import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: leads, error } = await supabase
      .from("leads")
      .select("date_entered, promo_claimed, booking_confirmed, sms_delivered, sms_status")
      .eq("client_id", "islay_studios");

    if (error) throw error;

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalLeads = leads?.length ?? 0;
    let newThisWeek = 0;
    let promoClaims = 0;
    let bookingsConfirmed = 0;
    let smsSent = 0;
    let smsFailed = 0;

    for (const lead of leads || []) {
      if (lead.date_entered && new Date(lead.date_entered) >= oneWeekAgo) {
        newThisWeek++;
      }
      if (lead.promo_claimed) promoClaims++;
      if (lead.booking_confirmed) bookingsConfirmed++;
      if (lead.sms_delivered || lead.sms_status === "sent") smsSent++;
      if (lead.sms_status === "failed" || lead.sms_status === "failed_no_credits") smsFailed++;
    }

    return NextResponse.json({
      totalLeads,
      newThisWeek,
      promoClaims,
      bookingsConfirmed,
      smsSent,
      smsFailed,
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data: leads, error } = await supabase
      .from("leads")
      .select("date_entered, promo_claimed, booking_confirmed");

    if (error) throw error;

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalLeads = leads?.length ?? 0;
    let newThisWeek = 0;
    let promoClaims = 0;
    let bookingsConfirmed = 0;

    for (const lead of leads || []) {
      if (lead.date_entered && new Date(lead.date_entered) >= oneWeekAgo) {
        newThisWeek++;
      }
      if (lead.promo_claimed) promoClaims++;
      if (lead.booking_confirmed) bookingsConfirmed++;
    }

    return NextResponse.json({
      totalLeads,
      newThisWeek,
      promoClaims,
      bookingsConfirmed,
    });
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 },
    );
  }
}

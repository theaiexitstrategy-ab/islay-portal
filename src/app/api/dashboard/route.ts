import { NextResponse } from "next/server";
import { listRecords } from "@/lib/airtable";

const TABLE_ID = process.env.AIRTABLE_LEADS_TABLE_ID!;

export async function GET() {
  try {
    const leads = await listRecords(TABLE_ID);

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalLeads = leads.length;

    let newThisWeek = 0;
    let promoClaims = 0;
    let bookingsConfirmed = 0;

    for (const lead of leads) {
      const fields = lead.fields as Record<string, unknown>;

      const dateEntered = fields["Date Entered Funnel"] as string | undefined;
      if (dateEntered && new Date(dateEntered) >= oneWeekAgo) {
        newThisWeek++;
      }

      if (fields["Promo Claimed"]) {
        promoClaims++;
      }

      if (fields["Booking Confirmed"]) {
        bookingsConfirmed++;
      }
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

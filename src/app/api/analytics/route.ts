import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const clientId = "islay_studios";

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all data in parallel
    const [leadsRes, creditsRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id, date_entered, lead_source, artist_selected, sms_delivered, sms_status, client_id")
        .eq("client_id", clientId),
      supabase
        .from("credit_transactions")
        .select("amount, created_at")
        .eq("client_id", clientId)
        .lt("amount", 0)
        .gte("created_at", startOfMonth),
    ]);

    const leads = leadsRes.data ?? [];
    const creditTxns = creditsRes.data ?? [];

    // Total leads this month vs last month
    const leadsThisMonth = leads.filter(
      (l) => l.date_entered && l.date_entered >= startOfMonth,
    ).length;
    const leadsLastMonth = leads.filter(
      (l) =>
        l.date_entered &&
        l.date_entered >= startOfLastMonth &&
        l.date_entered <= endOfLastMonth,
    ).length;

    // Leads by source
    const bySource: Record<string, number> = {};
    for (const l of leads) {
      const src = l.lead_source || "Unknown";
      bySource[src] = (bySource[src] || 0) + 1;
    }

    // Leads by artist
    const byArtist: Record<string, number> = {};
    for (const l of leads) {
      const artist = l.artist_selected || "Unassigned";
      byArtist[artist] = (byArtist[artist] || 0) + 1;
    }

    // SMS delivery rate
    const leadsWithPhone = leads.filter(
      (l) => l.sms_status === "sent" || l.sms_status === "failed" || l.sms_status === "failed_no_credits" || l.sms_delivered,
    );
    const smsSent = leads.filter((l) => l.sms_delivered || l.sms_status === "sent").length;
    const smsFailed = leads.filter(
      (l) => l.sms_status === "failed" || l.sms_status === "failed_no_credits",
    ).length;

    // Leads over last 30 days (grouped by date)
    const last30Days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      last30Days[key] = 0;
    }
    for (const l of leads) {
      if (l.date_entered && l.date_entered >= thirtyDaysAgo) {
        const key = l.date_entered.split("T")[0];
        if (key in last30Days) {
          last30Days[key]++;
        }
      }
    }

    // Credits spent this month (sum of negative amounts)
    const creditsSpent = creditTxns.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0,
    );

    return NextResponse.json({
      leadsThisMonth,
      leadsLastMonth,
      bySource,
      byArtist,
      smsSent,
      smsFailed,
      leadsOverTime: last30Days,
      creditsSpent,
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 },
    );
  }
}

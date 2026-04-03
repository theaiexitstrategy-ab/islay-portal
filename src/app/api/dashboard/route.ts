import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Missing Supabase env vars", envCheck: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "MISSING",
        key: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING",
      }},
      { status: 500 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*")
    .eq("client_id", "islay_studios");

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code, hint: error.hint, details: error.details },
      { status: 500 },
    );
  }

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
}

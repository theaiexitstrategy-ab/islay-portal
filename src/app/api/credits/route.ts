import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const clientId = "islay_studios";

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [balanceRes, transactionsRes, autoReloadRes, recentUsageRes] = await Promise.all([
      supabase
        .from("credits")
        .select("balance")
        .eq("client_id", clientId)
        .single(),
      supabase
        .from("credit_transactions")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("auto_reload")
        .select("*")
        .eq("client_id", clientId)
        .single(),
      // Get SMS deductions over last 30 days for daily average
      supabase
        .from("credit_transactions")
        .select("amount, created_at")
        .eq("client_id", clientId)
        .lt("amount", 0)
        .gte("created_at", thirtyDaysAgo),
    ]);

    const balance = balanceRes.data?.balance ?? 0;
    const transactions = transactionsRes.data ?? [];
    const autoReload = autoReloadRes.data ?? null;

    // Calculate running balance for transactions
    let runningBalance = balance;
    const transactionsWithBalance = transactions.map((txn) => {
      const bal = runningBalance;
      runningBalance -= txn.amount;
      return { ...txn, running_balance: bal };
    });

    // Calculate average daily SMS usage over last 30 days
    const recentDeductions = recentUsageRes.data ?? [];
    const totalDeducted = recentDeductions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0,
    );
    const avgDailyUsage = totalDeducted / 30;
    const projectedDaysRemaining =
      avgDailyUsage > 0 ? Math.floor(balance / avgDailyUsage) : null;

    // Get Twilio balance
    let twilioBalance: number | null = null;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    if (twilioSid && twilioToken) {
      try {
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Balance.json`,
          {
            headers: { Authorization: `Basic ${auth}` },
          },
        );
        if (res.ok) {
          const data = await res.json();
          twilioBalance = parseFloat(data.balance);
        }
      } catch {
        // Twilio balance fetch failed, continue without it
      }
    }

    return NextResponse.json({
      balance,
      transactions: transactionsWithBalance,
      autoReload,
      avgDailyUsage: Math.round(avgDailyUsage * 10) / 10,
      projectedDaysRemaining,
      twilioBalance,
    });
  } catch (error) {
    console.error("Failed to fetch credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 },
    );
  }
}

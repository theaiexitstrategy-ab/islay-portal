import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Missing Supabase env vars" },
      { status: 500 },
    );
  }

  const supabase = getSupabaseAdmin();
  const clientId = "islay_studios";
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch each query independently so one failure doesn't break everything
  const { data: balanceData } = await supabase
    .from("credits")
    .select("balance, credits_per_sms, low_balance_threshold, account_status, trial_credits_granted, trial_expires_at")
    .eq("client_id", clientId)
    .single();

  const { data: transactionsData } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: autoReloadData } = await supabase
    .from("auto_reload")
    .select("*")
    .eq("client_id", clientId)
    .single();

  const { data: recentUsageData } = await supabase
    .from("credit_transactions")
    .select("amount, created_at")
    .eq("client_id", clientId)
    .lt("amount", 0)
    .gte("created_at", thirtyDaysAgo);

  const balance = balanceData?.balance ?? 0;
  const creditsPerSms = balanceData?.credits_per_sms ?? 1;
  const lowBalanceThreshold = balanceData?.low_balance_threshold ?? 50;
  const accountStatus = balanceData?.account_status ?? "active";
  const transactions = transactionsData ?? [];
  const autoReload = autoReloadData ?? null;

  // Calculate running balance for transactions
  let runningBalance = balance;
  const transactionsWithBalance = transactions.map((txn: Record<string, unknown>) => {
    const bal = runningBalance;
    runningBalance -= (txn.amount as number) || 0;
    return { ...txn, running_balance: bal };
  });

  // Find last reload date (most recent positive transaction)
  const lastReload = transactions.find(
    (t: Record<string, unknown>) => (t.amount as number) > 0,
  );
  const lastReloadDate = lastReload
    ? (lastReload as Record<string, unknown>).created_at
    : null;

  // Calculate average daily SMS usage over last 30 days
  const recentDeductions = recentUsageData ?? [];
  const totalDeducted = recentDeductions.reduce(
    (sum: number, t: Record<string, unknown>) => sum + Math.abs((t.amount as number) || 0),
    0,
  );
  const avgDailyUsage = totalDeducted / 30;
  const projectedDaysRemaining =
    avgDailyUsage > 0 ? Math.floor(balance / avgDailyUsage) : null;

  return NextResponse.json({
    balance,
    creditsPerSms: creditsPerSms,
    lowBalanceThreshold: lowBalanceThreshold,
    accountStatus: accountStatus,
    smsRemaining: Math.floor(balance / creditsPerSms),
    lastReloadDate,
    transactions: transactionsWithBalance,
    autoReload,
    avgDailyUsage: Math.round(avgDailyUsage * 10) / 10,
    projectedDaysRemaining,
  });
}

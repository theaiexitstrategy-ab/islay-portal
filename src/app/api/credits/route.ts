import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const clientId = "islay_studios";

    const [balanceRes, transactionsRes] = await Promise.all([
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
    ]);

    return NextResponse.json({
      balance: balanceRes.data?.balance ?? 0,
      transactions: transactionsRes.data ?? [],
    });
  } catch (error) {
    console.error("Failed to fetch credits:", error);
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 },
    );
  }
}

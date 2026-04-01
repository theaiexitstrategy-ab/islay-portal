import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  // 1. Check env vars
  diagnostics.envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING",
  };

  try {
    const supabase = getSupabaseAdmin();

    // 2. Count all leads (no filter)
    const { data: allLeads, error: allErr, count: allCount } = await supabase
      .from("leads")
      .select("id, client_id", { count: "exact" })
      .limit(5);
    diagnostics.allLeads = {
      count: allCount ?? allLeads?.length ?? 0,
      error: allErr?.message ?? null,
      sample: allLeads?.map((l) => ({ id: l.id, client_id: l.client_id })) ?? [],
    };

    // 3. Count leads with client_id filter
    const { data: filteredLeads, error: filtErr, count: filtCount } = await supabase
      .from("leads")
      .select("id, client_id, full_name, date_entered", { count: "exact" })
      .eq("client_id", "islay_studios")
      .limit(5);
    diagnostics.islayLeads = {
      count: filtCount ?? filteredLeads?.length ?? 0,
      error: filtErr?.message ?? null,
      sample: filteredLeads ?? [],
    };

    // 4. Check distinct client_ids
    const { data: clientIds, error: clientErr } = await supabase
      .from("leads")
      .select("client_id")
      .limit(50);
    const uniqueClientIds = [...new Set((clientIds ?? []).map((r) => r.client_id))];
    diagnostics.distinctClientIds = {
      values: uniqueClientIds,
      error: clientErr?.message ?? null,
    };

    // 5. Check credits table
    const { data: credits, error: credErr } = await supabase
      .from("credits")
      .select("*")
      .eq("client_id", "islay_studios")
      .single();
    diagnostics.credits = {
      data: credits,
      error: credErr?.message ?? null,
    };

    // 6. Check if sms_status column exists (query with it)
    const { data: smsTest, error: smsErr } = await supabase
      .from("leads")
      .select("sms_status")
      .limit(1);
    diagnostics.smsStatusColumn = {
      exists: !smsErr,
      error: smsErr?.message ?? null,
    };

    // 7. Check tables exist
    for (const table of ["leads", "credits", "credit_transactions", "auto_reload", "artists"]) {
      const { error: tErr } = await supabase.from(table).select("id").limit(1);
      diagnostics[`table_${table}`] = tErr ? `ERROR: ${tErr.message}` : "OK";
    }

  } catch (error) {
    diagnostics.fatalError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(diagnostics, {
    headers: { "Cache-Control": "no-store" },
  });
}

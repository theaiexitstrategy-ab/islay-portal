import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const diagnostics: Record<string, unknown> = {};

  // Check env vars
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  diagnostics.envVars = {
    NEXT_PUBLIC_SUPABASE_URL: url ? `SET (${url.substring(0, 30)}...)` : "MISSING",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING",
    SUPABASE_SERVICE_ROLE_KEY: key ? `SET (${key.substring(0, 10)}...)` : "MISSING",
  };

  if (!url || !key) {
    diagnostics.fatalError = "Missing Supabase env vars — data APIs will fail";
    return NextResponse.json(diagnostics, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Test each table individually
    for (const table of ["leads", "artists", "calls", "blasts", "credits", "credit_transactions", "auto_reload"]) {
      const { data, error, count } = await supabase
        .from(table)
        .select("*", { count: "exact" })
        .limit(3);
      diagnostics[`table_${table}`] = {
        status: error ? "ERROR" : "OK",
        error: error ? { message: error.message, code: error.code, hint: error.hint, details: error.details } : null,
        rowCount: count ?? data?.length ?? 0,
        sampleIds: (data ?? []).slice(0, 3).map((r: Record<string, unknown>) => r.id),
      };
    }

    // Test leads with client_id filter specifically
    const { data: filteredLeads, error: filtErr } = await supabase
      .from("leads")
      .select("id, client_id, full_name, date_entered")
      .eq("client_id", "islay_studios")
      .order("date_entered", { ascending: false })
      .limit(5);
    diagnostics.islayLeads = {
      error: filtErr ? { message: filtErr.message, code: filtErr.code, hint: filtErr.hint } : null,
      count: filteredLeads?.length ?? 0,
      sample: filteredLeads ?? [],
    };

    // Check distinct client_ids
    const { data: allLeads } = await supabase
      .from("leads")
      .select("client_id")
      .limit(100);
    const uniqueIds = [...new Set((allLeads ?? []).map((r: Record<string, unknown>) => r.client_id))];
    diagnostics.distinctClientIds = uniqueIds;

  } catch (error) {
    diagnostics.fatalError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(diagnostics, { headers: { "Cache-Control": "no-store" } });
}

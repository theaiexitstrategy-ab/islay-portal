import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const CLIENT_ID = "islay_studios";

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("billing_records")
    .select("*")
    .eq("client_id", CLIENT_ID)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

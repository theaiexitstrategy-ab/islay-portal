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
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code, hint: error.hint, details: error.details },
      { status: 500 },
    );
  }

  return NextResponse.json(data ?? []);
}

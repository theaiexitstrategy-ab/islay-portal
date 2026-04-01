import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("blasts")
      .select("*")
      .order("sent_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch blasts:", error);
    return NextResponse.json(
      { error: "Failed to fetch blasts" },
      { status: 500 },
    );
  }
}

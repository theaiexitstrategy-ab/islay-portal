import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const clientId = "islay_studios";
    const body = await req.json();

    const updates: Record<string, unknown> = {};
    if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
    if (typeof body.threshold === "number") updates.threshold = body.threshold;
    if (typeof body.bundle_type === "string") updates.bundle_type = body.bundle_type;
    if (typeof body.stripe_payment_method_id === "string")
      updates.stripe_payment_method_id = body.stripe_payment_method_id;

    // Upsert auto-reload settings
    const { data: existing } = await supabase
      .from("auto_reload")
      .select("id")
      .eq("client_id", clientId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("auto_reload")
        .update(updates)
        .eq("client_id", clientId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("auto_reload")
        .insert({ client_id: clientId, ...updates });
      if (error) throw error;
    }

    // Fetch updated settings
    const { data } = await supabase
      .from("auto_reload")
      .select("*")
      .eq("client_id", clientId)
      .single();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update auto-reload settings:", error);
    return NextResponse.json(
      { error: "Failed to update auto-reload settings" },
      { status: 500 },
    );
  }
}

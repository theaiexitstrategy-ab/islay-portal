import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("auto_reload")
    .select("*")
    .eq("client_id", "islay_studios")
    .single();

  if (error) {
    // Table might not exist yet — return defaults
    return NextResponse.json({
      client_id: "islay_studios",
      enabled: false,
      threshold: 20,
      bundle_type: "starter",
      stripe_payment_method_id: null,
    });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const clientId = "islay_studios";

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
  if (typeof body.threshold === "number") updates.threshold = body.threshold;
  if (typeof body.bundle_type === "string") updates.bundle_type = body.bundle_type;
  if (typeof body.stripe_payment_method_id === "string")
    updates.stripe_payment_method_id = body.stripe_payment_method_id;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Check if row exists
  const { data: existing, error: selectErr } = await supabase
    .from("auto_reload")
    .select("id")
    .eq("client_id", clientId)
    .single();

  if (selectErr && selectErr.code !== "PGRST116") {
    // Table might not exist
    return NextResponse.json(
      { error: selectErr.message, code: selectErr.code, hint: selectErr.hint },
      { status: 500 },
    );
  }

  if (existing) {
    const { error: updateErr } = await supabase
      .from("auto_reload")
      .update(updates)
      .eq("client_id", clientId);
    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message, code: updateErr.code },
        { status: 500 },
      );
    }
  } else {
    const { error: insertErr } = await supabase
      .from("auto_reload")
      .insert({ client_id: clientId, ...updates });
    if (insertErr) {
      return NextResponse.json(
        { error: insertErr.message, code: insertErr.code },
        { status: 500 },
      );
    }
  }

  // Return updated settings
  const { data, error: fetchErr } = await supabase
    .from("auto_reload")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (fetchErr) {
    // Return the updates as confirmation even if re-fetch fails
    return NextResponse.json({ client_id: clientId, ...updates });
  }

  return NextResponse.json(data);
}

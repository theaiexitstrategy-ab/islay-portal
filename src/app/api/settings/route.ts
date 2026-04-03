import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const CLIENT_ID = "islay_studios";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("client_settings")
    .select("*")
    .eq("client_id", CLIENT_ID)
    .single();

  if (error) {
    // Return defaults if table doesn't exist yet
    return NextResponse.json({
      client_id: CLIENT_ID,
      studio_name: "iSlay Studios",
      owner_name: "Nathan Slay",
      owner_email: null,
      owner_phone: null,
      promo_code: "SLAY10",
      promo_amount: "$10 off",
      timezone: "America/Chicago",
      notification_email: true,
      notification_sms: true,
      low_credit_threshold: 20,
    });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowedFields = [
    "studio_name", "owner_name", "owner_email", "owner_phone",
    "promo_code", "promo_amount", "timezone",
    "notification_email", "notification_sms", "low_credit_threshold",
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Upsert
  const { data: existing } = await supabase
    .from("client_settings")
    .select("id")
    .eq("client_id", CLIENT_ID)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("client_settings")
      .update(updates)
      .eq("client_id", CLIENT_ID);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("client_settings")
      .insert({ client_id: CLIENT_ID, ...updates });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = await supabase
    .from("client_settings")
    .select("*")
    .eq("client_id", CLIENT_ID)
    .single();

  return NextResponse.json(data);
}

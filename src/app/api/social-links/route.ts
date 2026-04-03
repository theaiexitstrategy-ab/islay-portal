import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const CLIENT_ID = "islay_studios";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("social_links")
    .select("*")
    .eq("client_id", CLIENT_ID)
    .order("platform");

  if (error) {
    // Return empty defaults if table doesn't exist
    return NextResponse.json([]);
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const platform = body.platform as string;
  if (!platform) {
    return NextResponse.json({ error: "platform is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { client_id: CLIENT_ID, platform };
  if (typeof body.username === "string") updates.username = body.username;
  if (typeof body.profile_url === "string") updates.profile_url = body.profile_url;
  if (typeof body.connected === "boolean") updates.connected = body.connected;
  if (typeof body.followers === "number") updates.followers = body.followers;

  // Upsert by client_id + platform
  const { data: existing } = await supabase
    .from("social_links")
    .select("id")
    .eq("client_id", CLIENT_ID)
    .eq("platform", platform)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("social_links")
      .update(updates)
      .eq("client_id", CLIENT_ID)
      .eq("platform", platform);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("social_links")
      .insert(updates);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return all links
  const { data } = await supabase
    .from("social_links")
    .select("*")
    .eq("client_id", CLIENT_ID)
    .order("platform");

  return NextResponse.json(data ?? []);
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");

  if (!platform) {
    return NextResponse.json({ error: "platform is required" }, { status: 400 });
  }

  await supabase
    .from("social_links")
    .update({ connected: false, username: null, profile_url: null })
    .eq("client_id", CLIENT_ID)
    .eq("platform", platform);

  return NextResponse.json({ success: true });
}

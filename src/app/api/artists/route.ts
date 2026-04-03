import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const CLIENT_ID = "islay_studios";

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Missing Supabase env vars" },
      { status: 500 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .eq("client_id", CLIENT_ID)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from("artists")
      .insert({
        client_id: CLIENT_ID,
        name: body.name,
        role: body.role || null,
        booking_url: body.booking_url || null,
        photo_url: body.photo_url || null,
        bio: body.bio || null,
        active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Artist ID required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("artists")
      .update(updates)
      .eq("id", id)
      .eq("client_id", CLIENT_ID)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

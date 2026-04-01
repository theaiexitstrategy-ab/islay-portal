import { NextRequest, NextResponse } from "next/server";

const SUPABASE_FUNCTION_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/stripe-checkout";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(SUPABASE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        bundle_id: body.bundle_id,
        client_id: "islay_studios",
        success_url: body.success_url,
        cancel_url: body.cancel_url,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Checkout failed" },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Stripe checkout proxy error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/twilio";
import { checkAndDeductCredits } from "@/lib/credits";

const CLIENT_ID = "islay_studios";

export async function POST(request: NextRequest) {
  try {
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json(
        { error: "Phone number and message are required" },
        { status: 400 },
      );
    }

    // Normalize phone number
    let normalized = phone.replace(/[\s\-().]/g, "");
    if (!normalized.startsWith("+")) {
      normalized = "+1" + normalized;
    }

    // CREDIT GATE: Deduct 1 credit before sending
    try {
      await checkAndDeductCredits(CLIENT_ID, 1);
    } catch (creditError) {
      return NextResponse.json(
        { error: creditError instanceof Error ? creditError.message : "Insufficient credits" },
        { status: 402 },
      );
    }

    const result = await sendSMS(normalized, message);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send SMS" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, sid: result.sid });
  } catch (error) {
    console.error("Failed to send single SMS:", error);
    return NextResponse.json(
      { error: "Failed to send SMS" },
      { status: 500 },
    );
  }
}

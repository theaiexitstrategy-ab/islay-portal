import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const CLIENT_ID = "islay_studios";
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = "a04cb686-85ce-4b37-b529-6f5dfb812edf";

export async function POST(request: NextRequest) {
  try {
    const { phone, reason, mode, note } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }

    // Normalize phone number
    let normalized = phone.replace(/[\s\-().]/g, "");
    if (!normalized.startsWith("+")) {
      normalized = "+1" + normalized;
    }

    const supabase = getSupabaseAdmin();
    let status = "initiated";
    let callId: string | undefined;

    if (mode === "ai") {
      // AI Assistant Outbound Call via Vapi
      if (!VAPI_API_KEY) {
        return NextResponse.json({ error: "Vapi API key not configured" }, { status: 500 });
      }

      const reasonContext: Record<string, string> = {
        reschedule: "Hi, I'm calling from iSlay Studios to help reschedule your appointment.",
        cancel: "Hi, I'm calling from iSlay Studios regarding a cancellation request.",
        reminder: "Hi, this is a friendly reminder from iSlay Studios about your upcoming appointment.",
        promo: "Hi, I'm calling from iSlay Studios with an exciting promotion for you!",
      };

      const firstMessage = reason === "custom" && note
        ? note
        : reasonContext[reason] || "Hi, I'm calling from iSlay Studios.";

      const vapiRes = await fetch("https://api.vapi.ai/call/phone", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${VAPI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistantId: VAPI_ASSISTANT_ID,
          customer: { number: normalized },
          assistantOverrides: { firstMessage },
        }),
      });

      const vapiData = await vapiRes.json();

      if (!vapiRes.ok) {
        status = "failed";
        console.error("Vapi call error:", vapiData);
      } else {
        callId = vapiData.id;
        status = "queued";
      }
    } else {
      // Manual Dial via Twilio Programmable Voice
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

      if (!twilioSid || !twilioToken || !twilioFrom) {
        return NextResponse.json({ error: "Twilio not configured" }, { status: 500 });
      }

      const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
      const params = new URLSearchParams();
      params.set("To", normalized);
      params.set("From", twilioFrom);
      // TwiML to connect the call
      params.set("Twiml", `<Response><Say>Connecting your call from iSlay Studios.</Say><Dial>${normalized}</Dial></Response>`);

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        },
      );

      const twilioData = await twilioRes.json();

      if (!twilioRes.ok) {
        status = "failed";
        console.error("Twilio call error:", twilioData);
      } else {
        callId = twilioData.sid;
        status = "queued";
      }
    }

    // Log call attempt to call_logs
    const { error: logError } = await supabase.from("call_logs").insert({
      client_id: CLIENT_ID,
      to_number: normalized,
      reason: reason === "custom" ? (note || "Custom") : reason,
      initiated_by: mode === "ai" ? "ai" : "manual",
      status,
    });

    if (logError) console.error("Failed to log call:", logError);

    return NextResponse.json({ success: status !== "failed", status, callId });
  } catch (error) {
    console.error("Outbound call error:", error);
    return NextResponse.json({ error: "Failed to initiate call" }, { status: 500 });
  }
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("call_logs")
    .select("*")
    .eq("client_id", CLIENT_ID)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

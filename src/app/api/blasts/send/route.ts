import { NextRequest, NextResponse } from "next/server";
import { listRecords, createRecord } from "@/lib/airtable";
import { sendSMS } from "@/lib/twilio";

const LEADS_TABLE_ID = process.env.AIRTABLE_LEADS_TABLE_ID!;
const BLASTS_TABLE_ID = process.env.AIRTABLE_BLASTS_TABLE_ID!;

function buildFilter(
  segment: string,
  artistFilter?: string,
): string | undefined {
  switch (segment) {
    case "all":
      return undefined;
    case "first_timers":
      return "{Booking Confirmed}=FALSE()";
    case "returning":
      return "{Booking Confirmed}=TRUE()";
    case "no_shows":
      return '{Status}="No Show"';
    case "by_artist":
      return `AND({Artist}="${artistFilter}")`;
    default:
      return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, message, promoCode, segment, artistFilter } =
      await request.json();

    const filterByFormula = buildFilter(segment, artistFilter);

    const leads = await listRecords(LEADS_TABLE_ID, {
      ...(filterByFormula ? { filterByFormula } : {}),
    });

    let finalMessage = message;
    if (promoCode) {
      finalMessage += `\n\nUse code: ${promoCode}`;
    }

    let sent = 0;
    let failed = 0;

    for (const lead of leads) {
      const phone = (lead.fields as Record<string, unknown>)["Phone"] as string;
      if (!phone) {
        failed++;
        continue;
      }
      const result = await sendSMS(phone, finalMessage);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    await createRecord(BLASTS_TABLE_ID, {
      "Blast Name": name,
      Message: message,
      "Date Sent": new Date().toISOString(),
      Recipients: leads.length,
      Delivered: sent,
      Status: "Sent",
    });

    return NextResponse.json({ sent, failed });
  } catch (error) {
    console.error("Failed to send blast:", error);
    return NextResponse.json(
      { error: "Failed to send blast" },
      { status: 500 },
    );
  }
}

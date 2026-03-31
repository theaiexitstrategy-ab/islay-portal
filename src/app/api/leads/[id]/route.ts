import { NextRequest, NextResponse } from "next/server";
import { updateRecord } from "@/lib/airtable";

const TABLE_ID = process.env.AIRTABLE_LEADS_TABLE_ID!;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { fields } = await request.json();
    const record = await updateRecord(TABLE_ID, id, fields);
    return NextResponse.json(record);
  } catch (error) {
    console.error("Failed to update lead:", error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 },
    );
  }
}

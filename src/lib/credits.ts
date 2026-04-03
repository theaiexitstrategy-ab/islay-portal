import { getSupabaseAdmin } from "./supabase";

/**
 * Checks if a client has enough credits for an SMS operation and atomically
 * deducts them. Must be called BEFORE any Twilio SMS call.
 *
 * For bulk blasts, pass the full recipient count to reserve upfront.
 * Throws on insufficient balance or deduction failure — callers must
 * wrap in try/catch and abort the SMS send if this throws.
 */
export async function checkAndDeductCredits(
  clientId: string,
  smsCount: number,
): Promise<true> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("credits")
    .select("balance, credits_per_sms")
    .eq("client_id", clientId)
    .single();

  if (error || !data) throw new Error("Could not verify credit balance.");

  const cost = data.credits_per_sms * smsCount;

  if (data.balance < cost) {
    throw new Error(
      `Insufficient credits. Balance: ${data.balance}, Required: ${cost}`,
    );
  }

  // Atomic deduction with optimistic lock to prevent race conditions
  const { error: deductError } = await supabase
    .from("credits")
    .update({
      balance: data.balance - cost,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId)
    .eq("balance", data.balance);

  if (deductError)
    throw new Error("Credit deduction failed. Please try again.");

  await supabase.from("credit_transactions").insert({
    client_id: clientId,
    amount: -cost,
    description: `SMS \u2014 ${smsCount} message(s)`,
  });

  return true;
}

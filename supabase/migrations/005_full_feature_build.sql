-- ============================================================
-- Migration 005: Full Feature Build
-- Adds: credits_per_sms, low_balance_threshold, account_status,
--        trial fields to credits table
-- Creates: call_logs, billing_records, social_accounts tables
-- Adds: photo_url, bio, client_id to artists table
-- Updates: islay_studios seed data to 500 credits, active status
-- ============================================================

-- ============================================================
-- CREDITS TABLE — add missing columns
-- ============================================================
ALTER TABLE credits ADD COLUMN IF NOT EXISTS credits_per_sms integer NOT NULL DEFAULT 1;
ALTER TABLE credits ADD COLUMN IF NOT EXISTS low_balance_threshold integer NOT NULL DEFAULT 50;
ALTER TABLE credits ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active'
  CHECK (account_status IN ('trial', 'active', 'suspended'));
ALTER TABLE credits ADD COLUMN IF NOT EXISTS trial_credits_granted integer DEFAULT 0;
ALTER TABLE credits ADD COLUMN IF NOT EXISTS trial_expires_at timestamptz;

-- Add balance_non_negative constraint (backstop for application-layer enforcement)
ALTER TABLE credits ADD CONSTRAINT balance_non_negative CHECK (balance >= 0);

-- Update islay_studios to 500 credits and active status
UPDATE credits
SET balance = 500, account_status = 'active'
WHERE client_id = 'islay_studios' AND balance < 500;

-- ============================================================
-- ARTISTS TABLE — add missing columns
-- ============================================================
ALTER TABLE artists ADD COLUMN IF NOT EXISTS client_id text DEFAULT 'islay_studios';
ALTER TABLE artists ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- ============================================================
-- CALL LOGS (outbound calls from portal)
-- ============================================================
CREATE TABLE IF NOT EXISTS call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  to_number text,
  reason text,
  initiated_by text CHECK (initiated_by IN ('ai', 'manual')),
  status text,
  duration_seconds integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read call_logs"
  ON call_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert call_logs"
  ON call_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- BILLING RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  amount_cents integer NOT NULL,
  credits_purchased integer NOT NULL,
  status text DEFAULT 'pending',
  package text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read billing_records"
  ON billing_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert billing_records"
  ON billing_records FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- SOCIAL ACCOUNTS (OAuth-connected accounts with tokens)
-- ============================================================
CREATE TABLE IF NOT EXISTS social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  platform text NOT NULL,
  handle text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  follower_count integer,
  last_synced timestamptz,
  ga_property_id text,
  UNIQUE(client_id, platform)
);

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read social_accounts"
  ON social_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage social_accounts"
  ON social_accounts FOR ALL TO authenticated USING (true);

-- ============================================================
-- CLIENT SETTINGS — add missing columns for new preferences
-- ============================================================
ALTER TABLE client_settings ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT true;
ALTER TABLE client_settings ADD COLUMN IF NOT EXISTS sms_low_balance_alerts boolean DEFAULT true;

-- Update display name for Nathan
UPDATE client_settings
SET owner_name = 'Nathan Slay'
WHERE client_id = 'islay_studios';

-- ============================================================
-- Enable Realtime on new tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE billing_records;

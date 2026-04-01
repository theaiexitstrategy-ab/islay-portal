export interface Lead {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  date_entered: string | null;
  lead_source: string | null;
  promo_code: string | null;
  promo_claimed: boolean;
  promo_redeemed: boolean;
  artist_selected: string | null;
  booking_platform: string | null;
  booking_url: string | null;
  booking_confirmed: boolean;
  appointment_date: string | null;
  sms_delivered: boolean;
  sms_status: string | null;
  lead_status: string;
  notes: string | null;
  client_id: string;
  created_at: string;
}

export interface Call {
  id: string;
  caller_phone: string | null;
  call_direction: string | null;
  call_datetime: string | null;
  duration_seconds: number | null;
  vapi_call_id: string | null;
  call_outcome: string | null;
  artist_mentioned: string | null;
  transcript_summary: string | null;
  transcript_url: string | null;
  promo_mentioned: boolean | null;
  lead_created: boolean | null;
  created_at: string;
}

export interface Blast {
  id: string;
  blast_name: string | null;
  message_body: string | null;
  sent_at: string | null;
  total_recipients: number | null;
  delivered_count: number | null;
  failed_count: number | null;
  promo_code: string | null;
  target_segment: string | null;
  artist_filter: string | null;
  status: string;
  created_at: string;
}

export interface Artist {
  id: string;
  name: string | null;
  role: string | null;
  booking_platform: string | null;
  booking_url: string | null;
  total_leads: number;
  total_bookings: number;
  active: boolean;
}

export interface Credit {
  id: string;
  client_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  client_id: string;
  amount: number;
  description: string | null;
  lead_id: string | null;
  bundle_type: string | null;
  cost_per_credit: number | null;
  created_at: string;
}

export interface AutoReload {
  id: string;
  client_id: string;
  enabled: boolean;
  threshold: number;
  bundle_type: string;
  stripe_payment_method_id: string | null;
  created_at: string;
  updated_at: string;
}

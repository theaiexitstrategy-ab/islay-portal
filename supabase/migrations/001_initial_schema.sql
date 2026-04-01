-- ============================================================
-- iSlay Studios Portal — Supabase Migration
-- Creates: leads, calls, blasts, artists tables
-- Seeds: 7 artist records
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- LEADS
-- ============================================================
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  full_name     text,
  phone         text,
  email         text,
  date_entered  timestamptz default now(),
  lead_source   text,
  promo_code    text default 'SLAY10',
  promo_claimed boolean default false,
  promo_redeemed boolean default false,
  artist_selected text,
  booking_platform text,
  booking_url   text,
  booking_confirmed boolean default false,
  appointment_date date,
  sms_delivered boolean default false,
  lead_status   text default 'New',
  notes         text,
  created_at    timestamptz default now()
);

-- ============================================================
-- CALLS
-- ============================================================
create table if not exists calls (
  id                uuid primary key default gen_random_uuid(),
  caller_phone      text,
  call_direction    text,
  call_datetime     timestamptz,
  duration_seconds  integer,
  vapi_call_id      text,
  call_outcome      text,
  artist_mentioned  text,
  transcript_summary text,
  transcript_url    text,
  promo_mentioned   boolean,
  lead_created      boolean,
  created_at        timestamptz default now()
);

-- ============================================================
-- BLASTS
-- ============================================================
create table if not exists blasts (
  id               uuid primary key default gen_random_uuid(),
  blast_name       text,
  message_body     text,
  sent_at          timestamptz,
  total_recipients integer,
  delivered_count  integer,
  failed_count     integer,
  promo_code       text,
  target_segment   text,
  artist_filter    text,
  status           text default 'Draft',
  created_at       timestamptz default now()
);

-- ============================================================
-- ARTISTS
-- ============================================================
create table if not exists artists (
  id               uuid primary key default gen_random_uuid(),
  name             text,
  role             text,
  booking_platform text,
  booking_url      text,
  total_leads      integer default 0,
  total_bookings   integer default 0,
  active           boolean default true
);

-- ============================================================
-- Enable Row Level Security (allow all via service role)
-- ============================================================
alter table leads   enable row level security;
alter table calls   enable row level security;
alter table blasts  enable row level security;
alter table artists enable row level security;

-- Authenticated users can read all tables
create policy "Authenticated users can read leads"   on leads   for select to authenticated using (true);
create policy "Authenticated users can insert leads"  on leads   for insert to authenticated with check (true);
create policy "Authenticated users can update leads"  on leads   for update to authenticated using (true);

create policy "Authenticated users can read calls"   on calls   for select to authenticated using (true);
create policy "Authenticated users can insert calls"  on calls   for insert to authenticated with check (true);

create policy "Authenticated users can read blasts"  on blasts  for select to authenticated using (true);
create policy "Authenticated users can insert blasts" on blasts  for insert to authenticated with check (true);

create policy "Authenticated users can read artists" on artists for select to authenticated using (true);

-- Service role (used by edge functions / webhooks) bypasses RLS automatically

-- ============================================================
-- Enable Realtime on leads table
-- ============================================================
alter publication supabase_realtime add table leads;

-- ============================================================
-- SEED: Artists
-- ============================================================
insert into artists (name, role, booking_platform, booking_url, active) values
  ('Nathan Slay',    'Owner / Lead Barber',    'Square',    'https://square.site/book/islay-studios',   true),
  ('Beanz',          'Barber',                 'Square',    'https://square.site/book/islay-studios',   true),
  ('Fresh',          'Barber',                 'Square',    'https://square.site/book/islay-studios',   true),
  ('Q',              'Barber',                 'Square',    'https://square.site/book/islay-studios',   true),
  ('Sherry J',       'Stylist',                'Square',    'https://square.site/book/islay-studios',   true),
  ('Sabrina Young',  'Stylist',                'Square',    'https://square.site/book/islay-studios',   true),
  ('Eboni',          'Stylist',                'Square',    'https://square.site/book/islay-studios',   true);

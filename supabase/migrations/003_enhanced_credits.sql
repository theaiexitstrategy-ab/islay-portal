-- ============================================================
-- Migration 003: Enhanced Credits System
-- Adds: bundle_type & cost_per_credit to credit_transactions
-- Creates: auto_reload settings table
-- Enables: realtime on credits table
-- ============================================================

-- ============================================================
-- Add columns to credit_transactions
-- ============================================================
alter table credit_transactions add column if not exists bundle_type text;
alter table credit_transactions add column if not exists cost_per_credit numeric(10,4);

-- ============================================================
-- AUTO-RELOAD SETTINGS
-- ============================================================
create table if not exists auto_reload (
  id                      uuid primary key default gen_random_uuid(),
  client_id               text not null unique,
  enabled                 boolean not null default false,
  threshold               integer not null default 20,
  bundle_type             text not null default 'starter',
  stripe_payment_method_id text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

alter table auto_reload enable row level security;

create policy "Authenticated users can read auto_reload"
  on auto_reload for select to authenticated using (true);
create policy "Authenticated users can update auto_reload"
  on auto_reload for update to authenticated using (true);
create policy "Authenticated users can insert auto_reload"
  on auto_reload for insert to authenticated with check (true);

-- Auto-update updated_at trigger
create or replace function update_auto_reload_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger auto_reload_updated_at
  before update on auto_reload
  for each row execute function update_auto_reload_updated_at();

-- Seed default auto_reload settings for islay_studios
insert into auto_reload (client_id, enabled, threshold, bundle_type)
values ('islay_studios', false, 20, 'starter')
on conflict (client_id) do nothing;

-- ============================================================
-- Enable Realtime on credits and credit_transactions tables
-- ============================================================
alter publication supabase_realtime add table credits;
alter publication supabase_realtime add table credit_transactions;

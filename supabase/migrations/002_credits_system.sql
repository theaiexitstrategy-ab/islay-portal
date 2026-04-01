-- ============================================================
-- SMS Credits System — Migration
-- Creates: credits, credit_transactions tables
-- Adds: sms_status column to leads
-- Seeds: islay_studios with 100 free credits
-- ============================================================

-- ============================================================
-- CREDITS (balance per client)
-- ============================================================
create table if not exists credits (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null unique,
  balance     integer not null default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- CREDIT TRANSACTIONS (audit log)
-- ============================================================
create table if not exists credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,
  amount      integer not null, -- positive = purchase, negative = deduction
  description text,
  lead_id     uuid references leads(id),
  created_at  timestamptz default now()
);

-- ============================================================
-- Add sms_status to leads (for failed_no_credits tracking)
-- ============================================================
alter table leads add column if not exists sms_status text;

-- ============================================================
-- RLS
-- ============================================================
alter table credits enable row level security;
alter table credit_transactions enable row level security;

create policy "Authenticated users can read credits"
  on credits for select to authenticated using (true);
create policy "Authenticated users can read credit_transactions"
  on credit_transactions for select to authenticated using (true);

-- ============================================================
-- Auto-update updated_at on credits
-- ============================================================
create or replace function update_credits_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger credits_updated_at
  before update on credits
  for each row execute function update_credits_updated_at();

-- ============================================================
-- SEED: islay_studios with 100 free credits
-- ============================================================
insert into credits (client_id, balance)
values ('islay_studios', 100)
on conflict (client_id) do nothing;

insert into credit_transactions (client_id, amount, description)
values ('islay_studios', 100, 'Welcome bonus — 100 free SMS credits');

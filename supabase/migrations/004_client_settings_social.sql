-- ============================================================
-- Migration 004: Client Settings & Social Media Links
-- Creates: client_settings table for portal preferences
--          social_links table for linked social accounts
-- ============================================================

-- ============================================================
-- CLIENT SETTINGS (portal preferences per client)
-- ============================================================
create table if not exists client_settings (
  id                uuid primary key default gen_random_uuid(),
  client_id         text not null unique,
  studio_name       text default 'iSlay Studios',
  owner_name        text,
  owner_email       text,
  owner_phone       text,
  promo_code        text default 'SLAY10',
  promo_amount      text default '$10 off',
  timezone          text default 'America/Chicago',
  notification_email boolean default true,
  notification_sms  boolean default true,
  low_credit_threshold integer default 20,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table client_settings enable row level security;
create policy "Authenticated users can read client_settings"
  on client_settings for select to authenticated using (true);
create policy "Authenticated users can update client_settings"
  on client_settings for update to authenticated using (true);
create policy "Authenticated users can insert client_settings"
  on client_settings for insert to authenticated with check (true);

create or replace function update_client_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger client_settings_updated_at
  before update on client_settings
  for each row execute function update_client_settings_updated_at();

-- ============================================================
-- SOCIAL LINKS (linked social media accounts)
-- ============================================================
create table if not exists social_links (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null,
  platform      text not null, -- instagram, facebook, tiktok, twitter, youtube, google
  username      text,
  profile_url   text,
  connected     boolean default false,
  followers     integer,
  last_synced   timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(client_id, platform)
);

alter table social_links enable row level security;
create policy "Authenticated users can read social_links"
  on social_links for select to authenticated using (true);
create policy "Authenticated users can update social_links"
  on social_links for update to authenticated using (true);
create policy "Authenticated users can insert social_links"
  on social_links for insert to authenticated with check (true);
create policy "Authenticated users can delete social_links"
  on social_links for delete to authenticated using (true);

create or replace function update_social_links_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger social_links_updated_at
  before update on social_links
  for each row execute function update_social_links_updated_at();

-- ============================================================
-- SEED: Default settings for islay_studios
-- ============================================================
insert into client_settings (client_id, studio_name, owner_name, promo_code, promo_amount)
values ('islay_studios', 'iSlay Studios', 'Nathan Slay', 'SLAY10', '$10 off')
on conflict (client_id) do nothing;

-- Seed default social platforms
insert into social_links (client_id, platform, connected) values
  ('islay_studios', 'instagram', false),
  ('islay_studios', 'facebook', false),
  ('islay_studios', 'tiktok', false),
  ('islay_studios', 'google', false),
  ('islay_studios', 'youtube', false)
on conflict (client_id, platform) do nothing;

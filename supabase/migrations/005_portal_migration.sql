-- ============================================================
-- Migration 005: Portal Migration to goelev8.ai
-- Updates: Nathan's credits to 500, adjusts credit transaction log
-- ============================================================

-- Update islay_studios credit balance to 500
update credits
set balance = 500
where client_id = 'islay_studios';

-- Log the adjustment (only if not already logged)
insert into credit_transactions (client_id, amount, description)
select 'islay_studios', 400, 'Account setup — balance adjusted to 500 credits'
where not exists (
  select 1 from credit_transactions
  where client_id = 'islay_studios'
    and description = 'Account setup — balance adjusted to 500 credits'
);

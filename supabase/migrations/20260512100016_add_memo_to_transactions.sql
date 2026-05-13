-- 0016_add_memo_to_transactions.sql — add optional memo column to transactions.
-- The memo is a short freeform note shown beneath the category name in the
-- daily transaction list. Hard-capped at 100 characters at the DB layer so
-- the UI doesn't have to defend against pathological input.

alter table public.transactions
  add column if not exists memo text;

alter table public.transactions
  add constraint transactions_memo_length_check
  check (memo is null or char_length(memo) <= 100);

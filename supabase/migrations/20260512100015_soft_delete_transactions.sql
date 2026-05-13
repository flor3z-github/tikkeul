-- 0015_soft_delete_transactions.sql — add soft-delete column to transactions.
-- Postgres autovacuum reclaims dead tuples eventually, so soft delete keeps
-- the row recoverable while preserving the natural cleanup path.

alter table public.transactions
  add column if not exists deleted_at timestamptz;

-- Replace the active-row index with a partial index so list queries that
-- filter `deleted_at is null` stay cheap and don't traverse tombstones.
drop index if exists transactions_user_id_spent_at_idx;
create index if not exists transactions_user_id_spent_at_active_idx
  on public.transactions (user_id, spent_at desc)
  where deleted_at is null;

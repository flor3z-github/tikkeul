-- 20260512100048_user_settings_payday_payroll_rule.sql
-- M2 (Budget cycle Model B) — add payday + payroll_rule to user_settings.
--
-- These replace the calendar/income_day cycle model for RESOLUTION. The legacy
-- cycle_mode / cycle_start_day columns are DEPRECATED-PRESERVED (not dropped) so
-- this migration is reversible; Model B never reads them again.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ LOSSY, INTENTIONAL BACKFILL:                                              │
-- │   calendar mode historically absorbed BOTH 1일 payers AND 말일 payers     │
-- │   (the short-month 31-clamp workaround). We CANNOT distinguish them, so   │
-- │   every calendar-mode row backfills to payday=1 (1일 label). Real 말일    │
-- │   payers who were stored as calendar must RE-SELECT 말일 in settings —    │
-- │   surfaced via in-app copy, not migratable here.                          │
-- └─────────────────────────────────────────────────────────────────────────┘
--
-- payday convention: 0 = 말일 (shares the payment-day.ts 0=말일 convention),
-- 1..28 = that calendar day. payroll_rule: prev (default) / same / next.
--
-- Step order is deliberate so legacy >=29 income_day values can be remapped to
-- payday=0 BEFORE the CHECK (payday between 0 and 28) is added:
--   (1) ADD COLUMN nullable, no constraints
--   (2) BACKFILL every existing row (single UPDATE, guarded for idempotency)
--   (3) NOT NULL + DEFAULT + CHECK once no nulls / no >28 values remain.

-- (1) Nullable, unconstrained columns first.
alter table public.user_settings
  add column if not exists payday smallint,
  add column if not exists payroll_rule text;

-- (2) Backfill. payroll_rule is set EXPLICITLY here — a column DEFAULT only
-- applies to INSERT, never to this UPDATE. Guarded by `payday is null` so a
-- re-run is a no-op.
--   income_day 2..28  -> payday = N
--   income_day >= 29  -> payday = 0 (말일, incl. legacy 31-clamp victims)
--   calendar / other  -> payday = 1 (LOSSY: absorbs historical 말일 payers)
update public.user_settings
set
  payday = case
    when cycle_mode = 'income_day' and cycle_start_day between 2 and 28 then cycle_start_day
    when cycle_mode = 'income_day' and cycle_start_day >= 29 then 0
    else 1
  end,
  payroll_rule = 'prev'
where payday is null;

-- (3) Now that backfill guarantees no nulls and no >28 values, lock down.
alter table public.user_settings
  alter column payday set default 1,
  alter column payday set not null,
  add constraint user_settings_payday_check check (payday between 0 and 28);

alter table public.user_settings
  alter column payroll_rule set default 'prev',
  alter column payroll_rule set not null,
  add constraint user_settings_payroll_rule_check
    check (payroll_rule in ('prev', 'same', 'next'));

comment on column public.user_settings.payday is
  '급여일: 0=말일(payment-day.ts 0=말일 관례 공유), 1..28=그 날. Model B 입금앵커.';
comment on column public.user_settings.payroll_rule is
  '급여 보정 규정: prev=이전 영업일(기본), same=보정 안 함, next=다음 영업일.';

-- REMINDER: regenerate lib/supabase/database.types.ts (or hand-edit) after
-- applying — the user_settings Row/Insert/Update gained payday + payroll_rule.

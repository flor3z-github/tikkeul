-- 20260512100047_holidays.sql
-- M1 (Budget cycle Model B) — public.holidays lookup table.
--
-- Stores ONLY public holidays (공휴일). Weekends (Sat/Sun) are NOT stored here;
-- they are computed in application code (lib/utils/payday-cycle.ts::isBusinessDay).
-- This table backs the paycheck-deposit-anchored budget cycle: a deposit date is
-- nudged off non-business days via the payroll_rule, where "business day" =
-- not Sat/Sun AND not present in this table.
--
-- Holidays are non-sensitive, so every authenticated user may READ all rows
-- (friend cycles are computed in JS from public holidays + the friend's
-- payday/payroll_rule). Writes are SQL-editor / service-role ONLY: there is no
-- INSERT/UPDATE/DELETE policy, so RLS denies all client writes. Users (or the
-- maintainer) must INSERT the new year's holidays here ANNUALLY.
--
-- NOTE: the 0=말일 convention lives on user_settings.payday — it has nothing to
-- do with this table. This table is keyed purely by calendar date.

create table if not exists public.holidays (
  d date primary key,
  name text
);

comment on table public.holidays is
  '공휴일 룩업 테이블. 주말은 코드에서 처리, 공휴일만 저장. 인증 유저 읽기 전용, 쓰기는 SQL editor/service role(매년 갱신).';
comment on column public.holidays.d is '공휴일 날짜(YYYY-MM-DD). primary key.';
comment on column public.holidays.name is '공휴일 이름(표시/디버깅용).';

alter table public.holidays enable row level security;

-- Public read for any authenticated session. No write policy: writes are
-- SQL-editor / service-role only (RLS denies all client INSERT/UPDATE/DELETE).
create policy holidays_select on public.holidays
  for select
  using (true);

revoke all on public.holidays from anon, public;
grant select on public.holidays to authenticated;

-- 2026 Korean public holidays + 2027 신정 (cycles cross the year boundary, so a
-- Dec 말일 cycle can end in 2027-01, and a Jan payday=1 cycle can start in
-- 2025-12 — but 2025-12-31 is not a holiday, so no 2025 seed is needed).
-- 대체공휴일 verified against weekday: 3/1=Sun→3/2 대체, 5/24=Sun→5/25 대체,
-- 8/15=Sat→8/17 대체, 10/3=Sat→10/5 대체. 현충일(6/6=Sat) has NO substitute
-- under Korean law and is intentionally not duplicated.
insert into public.holidays (d, name) values
  ('2026-01-01', '신정'),
  ('2026-02-16', '설날 연휴'),
  ('2026-02-17', '설날'),
  ('2026-02-18', '설날 연휴'),
  ('2026-03-01', '삼일절'),
  ('2026-03-02', '삼일절 대체공휴일'),
  ('2026-05-05', '어린이날'),
  ('2026-05-24', '부처님오신날'),
  ('2026-05-25', '부처님오신날 대체공휴일'),
  ('2026-06-06', '현충일'),
  ('2026-08-15', '광복절'),
  ('2026-08-17', '광복절 대체공휴일'),
  ('2026-09-24', '추석 연휴'),
  ('2026-09-25', '추석'),
  ('2026-09-26', '추석 연휴'),
  ('2026-10-03', '개천절'),
  ('2026-10-05', '개천절 대체공휴일'),
  ('2026-10-09', '한글날'),
  ('2026-12-25', '성탄절'),
  ('2027-01-01', '신정')
on conflict (d) do nothing;

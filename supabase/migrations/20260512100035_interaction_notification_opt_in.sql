-- 0035_interaction_notification_opt_in.sql
-- Per-user opt-in for reaction/comment push notifications. Independent from
-- friend_spending_notifications so the user can subscribe to one without the
-- other. Default false to match the existing privacy-conservative posture.

alter table public.user_settings
  add column if not exists transaction_interaction_notifications boolean not null default false;

comment on column public.user_settings.transaction_interaction_notifications is
  '내 거래에 친구가 반응/댓글을 달았을 때 푸시 알림을 받을지 여부. 기본 false.';

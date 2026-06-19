// Nickname validation. The nickname itself is generated server-side by the
// plpgsql public.random_nickname() in the handle_new_user trigger
// (supabase/migrations/20260512100017_seed_random_nicknames.sql), so there is
// no client-side generator here — only format/length validation for edits.

export const NICKNAME_MAX_LENGTH = 20;

export function isValidNickname(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > NICKNAME_MAX_LENGTH) return false;
  if (/[\r\n\t]/.test(trimmed)) return false;
  return true;
}

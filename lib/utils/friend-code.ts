import { randomBytes } from "node:crypto";

// 32-char alphabet excluding 0, O, 1, I to avoid visual confusion when users
// transcribe codes manually.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const FRIEND_CODE_LENGTH = 6;
export const FRIEND_CODE_TTL_MINUTES = 10;

export function generateFriendCode(): string {
  const bytes = randomBytes(FRIEND_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < FRIEND_CODE_LENGTH; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function isValidFriendCodeFormat(code: string): boolean {
  if (code.length !== FRIEND_CODE_LENGTH) return false;
  for (let i = 0; i < code.length; i += 1) {
    if (!ALPHABET.includes(code[i])) return false;
  }
  return true;
}

export function normalizeFriendCodeInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, FRIEND_CODE_LENGTH);
}

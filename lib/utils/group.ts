export const GROUP_NAME_MAX_LENGTH = 20;

export function isValidGroupName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > GROUP_NAME_MAX_LENGTH) return false;
  if (/[\r\n\t]/.test(trimmed)) return false;
  return true;
}

export function normalizeGroupName(value: string): string {
  return value.trim();
}

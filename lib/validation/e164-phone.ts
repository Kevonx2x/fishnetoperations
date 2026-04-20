/** E.164: + then 1–15 digits (first digit after + is 1–9). */
export const E164_COMPACT_REGEX = /^\+[1-9]\d{1,14}$/;

export function compactPhoneForE164(value: string): string {
  return value.trim().replace(/\s/g, "");
}

export function isE164Compact(value: string): boolean {
  return E164_COMPACT_REGEX.test(compactPhoneForE164(value));
}

export const E164_INVALID_MESSAGE =
  "Phone must be in E.164 format: +[country code][number] (2–15 digits after +).";

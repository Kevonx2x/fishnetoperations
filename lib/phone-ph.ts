import {
  formatPhMobileInput,
  phMobileDigits,
  validatePhoneField as validatePhMobileStrict,
} from "@/lib/validation/agent-registration";

export { formatPhMobileInput, phMobileDigits } from "@/lib/validation/agent-registration";

/** True if value is empty or only "+63" / whitespace (no national digits yet). */
export function isPhoneEmptyOrPrefixOnly(value: string): boolean {
  const d = phMobileDigits(value);
  return d.length === 0;
}

/**
 * Philippine mode: starts with +63 (after trim) or is empty.
 * If user deleted +63 and typed something else, international mode.
 */
export function isPhilippinePhoneMode(value: string): boolean {
  const t = value.trim();
  if (t === "") return true;
  return t.startsWith("+63");
}

/** +63 path: valid 9XXXXXXXXX or empty/prefix-only. Other +prefix: no error from this helper. */
export function validatePhilippinePhoneInput(value: string): string | null {
  const t = value.trim();
  if (t === "" || t === "+63") return null;
  if (!isPhilippinePhoneMode(t)) return null;
  return validatePhMobileStrict(t);
}

/**
 * Controlled change: keep +63 formatting; if user removes +63, allow freeform international.
 */
export function normalizePhoneFieldInput(raw: string): string {
  const v = raw;
  if (v === "") return "";
  const trimmed = v.trimStart();
  if (trimmed.startsWith("+") && !trimmed.startsWith("+63")) {
    return v;
  }
  return formatPhMobileInput(v);
}

/** Display default when profile has no phone */
export const DEFAULT_PH_PHONE = "+63";

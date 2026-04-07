/** PRC-AG-YYYY-XXXXX (9 digits after PRC-AG-) */
export function formatPrcLicenseInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length === 0) return "";
  const y = digits.slice(0, 4);
  const n = digits.slice(4);
  if (digits.length <= 4) return `PRC-AG-${y}`;
  return `PRC-AG-${y}-${n}`;
}

export const PRC_LICENSE_REGEX = /^PRC-AG-\d{4}-\d{5}$/;

/** +63 9XX XXX XXXX — digits only in UI, stores formatted string */
export function formatPhMobileInput(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("63")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length === 0) return "";
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);
  let s = `+63 ${a}`;
  if (b) s += ` ${b}`;
  if (c) s += ` ${c}`;
  return s;
}

/** Returns digits-only national part (10 digits) for validation */
export function phMobileDigits(formatted: string): string {
  let d = formatted.replace(/\D/g, "");
  if (d.startsWith("63")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAgentName(name: string): string | null {
  const t = name.trim();
  if (t.length < 2) return "Enter at least 2 characters.";
  if (!/^[a-zA-Z\s'-]+$/.test(t)) return "Use letters only (spaces, hyphens, apostrophes allowed).";
  return null;
}

export function validateEmailField(email: string): string | null {
  const t = email.trim();
  if (!t) return "Email is required.";
  if (!EMAIL_REGEX.test(t)) return "Enter a valid email address.";
  return null;
}

export function validatePasswordField(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  return null;
}

export function validateLicenseField(formatted: string): string | null {
  const t = formatted.trim();
  if (!t) return "License number is required.";
  if (!PRC_LICENSE_REGEX.test(t)) return "Use format PRC-AG-YYYY-XXXXX (e.g. PRC-AG-2024-12345).";
  return null;
}

export function validateLicenseExpiry(isoDate: string): string | null {
  const t = isoDate.trim();
  if (!t) return "License expiry is required.";
  const d = new Date(t + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "Enter a valid date.";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d <= today) return "License expiry must be a future date.";
  return null;
}

export function validatePhoneField(formatted: string): string | null {
  const d = phMobileDigits(formatted);
  if (d.length !== 10) return "Enter a 10-digit mobile number (+63 9XX XXX XXXX).";
  if (!d.startsWith("9")) return "Philippine mobile numbers start with 9.";
  return null;
}

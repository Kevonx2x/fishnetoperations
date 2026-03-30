import { addDays, format, isValid, parseISO, startOfDay } from "date-fns";

/** True when license is not expired and expires within `days` (inclusive). */
export function isLicenseExpiringWithinDays(
  licenseExpiry: string | null | undefined,
  days = 30,
): boolean {
  if (!licenseExpiry) return false;
  const raw = licenseExpiry.length === 10 ? `${licenseExpiry}T12:00:00` : licenseExpiry;
  const exp = startOfDay(parseISO(raw));
  if (!isValid(exp)) return false;
  const today = startOfDay(new Date());
  if (exp < today) return false;
  const limit = addDays(today, days);
  return exp <= limit;
}

/** Format YYYY-MM-DD for display */
export function formatLicenseDate(licenseExpiry: string | null | undefined): string {
  if (!licenseExpiry) return "";
  const raw = licenseExpiry.length === 10 ? `${licenseExpiry}T12:00:00` : licenseExpiry;
  const d = parseISO(raw);
  if (!isValid(d)) return licenseExpiry;
  return format(d, "MMM d, yyyy");
}

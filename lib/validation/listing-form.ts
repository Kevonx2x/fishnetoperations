/** Parse display price like ₱1,500,000 or 1500000 to integer pesos */
export function parseListingPricePesos(raw: string): number | null {
  const s = raw.replace(/[₱,\s]/g, "").trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export function formatPriceInputDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  if (!digits) return "";
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n)) return "";
  return `₱${n.toLocaleString("en-US")}`;
}

export function validateListingPriceDisplay(display: string): string | null {
  const n = parseListingPricePesos(display);
  if (n === null) return "Price is required.";
  if (n < 1_000) return "Minimum price is ₱1,000.";
  if (n > 500_000_000) return "Maximum price is ₱500,000,000.";
  return null;
}

export function formatDigitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

export function validateSqft(s: string): string | null {
  const d = s.replace(/\D/g, "");
  if (d === "") return "Sqft is required.";
  const n = Number.parseInt(d, 10);
  if (!Number.isFinite(n)) return "Sqft is required.";
  if (n < 10) return "Minimum 10 sqft.";
  if (n > 100_000) return "Maximum 100,000 sqft.";
  return null;
}

export function validateBedsBaths(s: string, label: string): string | null {
  const d = s.replace(/\D/g, "");
  if (d === "") return `${label} is required.`;
  const n = Number.parseInt(d, 10);
  if (!Number.isFinite(n) || n < 0 || n > 20) return `${label} must be between 0 and 20.`;
  return null;
}

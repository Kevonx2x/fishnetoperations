/** RFC 4122 UUID string (loose; matches Zod-style agency row ids). */
const AGENCY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAgencyUuidString(value: string): boolean {
  return AGENCY_UUID_RE.test(value.trim());
}

/** Only submit agency_id when it is a UUID (never a display name or junk). */
export function agencyIdForAgentApi(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return isAgencyUuidString(t) ? t : null;
}

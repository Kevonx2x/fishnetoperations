/** RFC 4122 UUID string (loose; matches Zod-style broker row ids). */
const BROKER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBrokerUuidString(value: string): boolean {
  return BROKER_UUID_RE.test(value.trim());
}

/** Only submit broker_id when it is a UUID (never a display name or junk). */
export function brokerIdForAgentApi(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return isBrokerUuidString(t) ? t : null;
}

export const CLIENT_ARCHIVE_REASON_KEYS = [
  "not_interested",
  "found_another",
  "too_expensive",
  "wrong_details",
  "other",
] as const;

export type ClientArchiveReasonKey = (typeof CLIENT_ARCHIVE_REASON_KEYS)[number];

export const CLIENT_ARCHIVE_REASON_LABEL: Record<ClientArchiveReasonKey, string> = {
  not_interested: "Not interested",
  found_another: "Found another property",
  too_expensive: "Too expensive",
  wrong_details: "Wrong details",
  other: "Other",
};

export function labelForClientArchiveReason(
  key: string | null | undefined,
  note: string | null | undefined,
): string {
  const k = String(key ?? "").trim() as ClientArchiveReasonKey;
  if (k === "other" && note?.trim()) return note.trim();
  if (k && k in CLIENT_ARCHIVE_REASON_LABEL) return CLIENT_ARCHIVE_REASON_LABEL[k as ClientArchiveReasonKey];
  return key?.trim() || "—";
}

export const CLIENT_DOCUMENT_TYPES = [
  { key: "valid_id", label: "Valid ID" },
  { key: "proof_of_funds", label: "Proof of Funds" },
  { key: "visa", label: "Visa Document" },
  { key: "other", label: "Other Document" },
] as const;

export type ClientDocumentTypeKey = (typeof CLIENT_DOCUMENT_TYPES)[number]["key"];

export function labelForClientDocType(key: string): string {
  const row = CLIENT_DOCUMENT_TYPES.find((d) => d.key === key);
  return row?.label ?? key;
}

export function isClientDocumentType(key: string): key is ClientDocumentTypeKey {
  return CLIENT_DOCUMENT_TYPES.some((d) => d.key === key);
}

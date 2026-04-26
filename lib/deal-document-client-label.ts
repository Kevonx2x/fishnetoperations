import { labelForClientDocType } from "@/lib/client-documents";

/** Agent-requested "Other" rows use a unique `document_type` like `other:<uuid>`. */
export function isSyntheticOtherDocumentType(documentType: string): boolean {
  return documentType.startsWith("other:");
}

export function displayLabelForClientDealDocument(
  documentType: string,
  documentName: string | null | undefined,
): string {
  const dn = documentName?.trim();
  if (isSyntheticOtherDocumentType(documentType)) return dn || "Other document";
  if (documentType === "other") return dn || "Other";
  return labelForClientDocType(documentType);
}

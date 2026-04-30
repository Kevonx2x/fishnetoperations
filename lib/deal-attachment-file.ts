/** Match client deal document uploads: size + common MIME types for PDF/DOC/DOCX/JPG/PNG */

export const DEAL_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

const ALLOWED_EXT = new Set(["pdf", "doc", "docx", "jpg", "jpeg", "png"]);

export function dealAttachmentAcceptAttr(): string {
  return ".pdf,.doc,.docx,image/jpeg,image/png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

export function validateDealAttachmentFile(file: File): string | null {
  if (!(file instanceof File) || file.size <= 0) {
    return "Please choose a file.";
  }
  if (file.size > DEAL_ATTACHMENT_MAX_BYTES) {
    return "File must be 10MB or smaller.";
  }
  const mime = (file.type || "").trim().toLowerCase();
  if (mime && ALLOWED_MIME.has(mime)) {
    return null;
  }
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  if (ext && ALLOWED_EXT.has(ext)) {
    return null;
  }
  return "Allowed types: PDF, DOC, DOCX, JPG, or PNG.";
}

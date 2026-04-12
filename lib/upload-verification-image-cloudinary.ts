/**
 * Upload a verification document image to Cloudinary via /api/upload with watermark.
 * Requires a signed-in agent/broker/admin session (same as listing uploads).
 */
export async function uploadVerificationImageToCloudinary(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("purpose", "verification");
  const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
  const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok) {
    throw new Error(typeof j.error === "string" ? j.error : "Upload failed");
  }
  if (typeof j.url !== "string" || !j.url) {
    throw new Error("Upload failed");
  }
  return j.url;
}

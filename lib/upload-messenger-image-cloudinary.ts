import { compressClientImage } from "@/lib/compress-client-image";

/**
 * Upload a messenger chat image to Cloudinary via /api/upload.
 * Any signed-in user may upload when purpose is messenger.
 */
export async function uploadMessengerImageToCloudinary(file: File): Promise<string> {
  const prepared = await compressClientImage(file);
  const fd = new FormData();
  fd.append("file", prepared);
  fd.append("purpose", "messenger");
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

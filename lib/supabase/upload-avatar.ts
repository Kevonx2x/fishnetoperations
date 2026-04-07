const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED.has(file.type)) {
    return "Please choose a JPG, PNG, or WEBP image.";
  }
  if (file.size > MAX_BYTES) {
    return "Image must be 2MB or smaller.";
  }
  return null;
}

export function avatarObjectExt(file: File): "jpg" | "png" | "webp" {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

/** Upload with XMLHttpRequest so we can report upload progress (0–100). */
export function uploadToAvatarsBucket(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
  path: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  const encodedPath = path
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  const url = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/avatars/${encodedPath}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        try {
          const j = JSON.parse(xhr.responseText) as { message?: string; error?: string };
          reject(new Error(j.message ?? j.error ?? `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
        }
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

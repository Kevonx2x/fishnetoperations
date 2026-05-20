import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

const PHOTO_BUCKET = "dormspace-photos";
const VERIFY_BUCKET = "dormspace-verification";

function extFromFile(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".gif")) return "gif";
  return "jpg";
}

export async function uploadDormspaceVerificationFile(
  admin: SupabaseClient,
  dormspaceId: string,
  kind: "id" | "billing",
  file: File,
): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const path = `${dormspaceId}/${kind}-${randomUUID()}.${extFromFile(file)}`;
  const { error } = await admin.storage.from(VERIFY_BUCKET).upload(path, buf, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function uploadDormspaceListingPhoto(
  admin: SupabaseClient,
  dormspaceId: string,
  file: File,
  order: number,
): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const path = `${dormspaceId}/${order}-${randomUUID()}.${extFromFile(file)}`;
  const { error } = await admin.storage.from(PHOTO_BUCKET).upload(path, buf, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function signedVerificationUrl(admin: SupabaseClient, storagePath: string): Promise<string | null> {
  if (!storagePath?.trim()) return null;
  const { data, error } = await admin.storage.from(VERIFY_BUCKET).createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

const CLOUDINARY_HOST = "res.cloudinary.com"
const UPLOAD_SEGMENT = "/upload/"

/**
 * For `res.cloudinary.com` URLs, inserts `f_auto/` right after `/upload/` when not already present.
 * Other URLs are returned unchanged (trimmed).
 */
export function getOptimizedImageUrl(url: string): string {
  const trimmed = (url ?? "").trim()
  if (!trimmed) return trimmed
  try {
    const u = new URL(trimmed)
    if (u.hostname !== CLOUDINARY_HOST) return trimmed
    const idx = u.pathname.indexOf(UPLOAD_SEGMENT)
    if (idx === -1) return trimmed
    const afterUpload = u.pathname.slice(idx + UPLOAD_SEGMENT.length)
    if (afterUpload.startsWith("f_auto/") || afterUpload.startsWith("f_auto,")) return trimmed
    const prefix = u.pathname.slice(0, idx + UPLOAD_SEGMENT.length)
    u.pathname = `${prefix}f_auto/${afterUpload}`
    return u.toString()
  } catch {
    return trimmed
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

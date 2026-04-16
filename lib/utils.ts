import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Tiny JPEG for `placeholder="blur"` on listing photos. */
export const LISTING_PHOTO_BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k="

const CLOUDINARY_HOST = "res.cloudinary.com"
const UPLOAD_SEGMENT = "/upload/"

/**
 * For `res.cloudinary.com` image URLs, inserts `f_auto,q_auto,w_800` immediately after `/upload/`.
 * Other URLs are returned unchanged.
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
    if (afterUpload.startsWith("f_auto,q_auto,w_800/")) return trimmed
    const prefix = u.pathname.slice(0, idx + UPLOAD_SEGMENT.length)
    u.pathname = `${prefix}f_auto,q_auto,w_800/${afterUpload}`
    return u.toString()
  } catch {
    return trimmed
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

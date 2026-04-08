"use client";

import Image from "next/image";
import { isSupabasePublicStorageUrl } from "@/lib/supabase/public-storage-url";

/** First letter of first name + first letter of last name (or first two letters of single name). */
export function agentAvatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AgentAvatarFill({
  name,
  imageUrl,
  sizes,
  textClassName = "text-[10px]",
}: {
  name: string;
  imageUrl?: string | null;
  sizes: string;
  textClassName?: string;
}) {
  if (imageUrl?.trim()) {
    if (isSupabasePublicStorageUrl(imageUrl)) {
      return <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />;
    }
    return <Image src={imageUrl} alt="" fill sizes={sizes} className="object-cover" />;
  }
  return (
    <span
      className={`flex h-full w-full items-center justify-center bg-[#6B9E6E] font-bold leading-none text-white ${textClassName}`}
    >
      {agentAvatarInitials(name)}
    </span>
  );
}

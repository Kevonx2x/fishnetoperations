"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import { isSupabasePublicStorageUrl } from "@/lib/supabase/public-storage-url";

const SAGE = "#6B9E6E";

type ClientAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  sizePx?: number;
  className?: string;
  textClassName?: string;
  ringClassName?: string;
};

/** Client profile image or sage initials on white (BahayGo client surfaces). */
export function ClientAvatar({
  name,
  avatarUrl,
  sizePx = 28,
  className,
  textClassName = "text-[11px]",
  ringClassName = "ring-2 ring-[#E5E5E5]",
}: ClientAvatarProps) {
  const u = avatarUrl?.trim() ?? "";
  const initials = agentAvatarInitials(name.trim() || "?");

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-[#6B9E6E]",
        ringClassName,
        className,
      )}
      style={{ width: sizePx, height: sizePx, backgroundColor: u ? "transparent" : SAGE }}
    >
      {u ? (
        isSupabasePublicStorageUrl(u) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u} alt="" className="h-full w-full object-cover" />
        ) : (
          <Image src={u} alt="" fill sizes={`${sizePx}px`} className="object-cover" />
        )
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center font-semibold leading-none text-white",
            textClassName,
          )}
        >
          {initials}
        </span>
      )}
    </span>
  );
}

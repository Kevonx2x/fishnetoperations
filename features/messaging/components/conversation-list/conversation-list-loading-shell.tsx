"use client";

import { useMemo } from "react";

import {
  readChannelListCache,
  type CachedChannelPreview,
} from "@/features/messaging/lib/channel-list-cache";
import { cn } from "@/lib/utils";

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-center gap-3 border-b border-black/[0.04] px-4 py-3.5">
      <div className="size-12 shrink-0 rounded-full bg-[#2C2C2C]/10" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-2/5 rounded-md bg-[#2C2C2C]/10" />
        <div className="h-3 w-4/5 rounded-md bg-[#2C2C2C]/8" />
      </div>
      <div className="h-3 w-10 shrink-0 rounded-md bg-[#2C2C2C]/8" />
    </div>
  );
}

function CachedRow({ row }: { row: CachedChannelPreview }) {
  return (
    <div
      className="flex items-center gap-3 border-b border-black/[0.04] px-4 py-3.5 opacity-80"
      aria-hidden
    >
      <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-[#6B9E6E]/15">
        {row.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-sm font-bold text-[#6B9E6E]">
            {row.title.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-semibold text-[#2C2C2C]">{row.title}</p>
          {row.time ? (
            <span className="shrink-0 text-[11px] font-medium text-[#888888]">{row.time}</span>
          ) : null}
        </div>
        <p className="truncate text-[13px] text-[#888888]">{row.preview}</p>
      </div>
      {row.unread > 0 ? (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E] px-1 text-[10px] font-bold text-white">
          {row.unread > 99 ? "99+" : row.unread}
        </span>
      ) : null}
    </div>
  );
}

export function ConversationListLoadingShell(props: {
  selfUserId: string;
  variant: "desktop" | "mobile";
  suppressMobileHeader?: boolean;
  className?: string;
}) {
  const cached = useMemo(
    () => (props.selfUserId ? readChannelListCache(props.selfUserId) : []),
    [props.selfUserId],
  );
  const showLargeHeader = props.variant === "desktop";
  const placeholderCount = cached.length > 0 ? Math.max(0, 6 - cached.length) : 6;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full shrink-0 flex-col border-b border-subtle bg-[#FAF8F4] md:border-b-0 md:border-r md:border-subtle md:w-[320px] md:min-w-[320px] md:max-w-[320px]",
        props.className,
      )}
      aria-busy="true"
      aria-label="Loading conversations"
    >
      {showLargeHeader ? (
        <div className="hidden shrink-0 border-b border-subtle bg-surface-page px-4 pb-4 pt-5 md:block">
          <div className="h-8 w-32 animate-pulse rounded-lg bg-[#2C2C2C]/10" />
          <div className="mt-3 flex gap-2">
            <div className="h-10 min-w-0 flex-1 animate-pulse rounded-xl bg-[#2C2C2C]/10" />
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-[#2C2C2C]/10" />
          </div>
        </div>
      ) : props.suppressMobileHeader ? (
        <div className="border-b border-subtle bg-[#FAF8F4] px-4 py-3 md:hidden">
          <div className="flex gap-2">
            <div className="h-10 min-w-0 flex-1 animate-pulse rounded-xl bg-[#2C2C2C]/10" />
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-[#2C2C2C]/10" />
          </div>
        </div>
      ) : (
        <div className="border-b border-subtle bg-[#FAF8F4] px-4 py-3 md:hidden">
          <div className="h-7 w-28 animate-pulse rounded-lg bg-[#2C2C2C]/10" />
          <div className="mt-2 flex gap-2">
            <div className="h-10 min-w-0 flex-1 animate-pulse rounded-xl bg-[#2C2C2C]/10" />
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-[#2C2C2C]/10" />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        {cached.map((row) => (
          <CachedRow key={row.id} row={row} />
        ))}
        {Array.from({ length: placeholderCount }, (_, i) => (
          <SkeletonRow key={`sk-${i}`} />
        ))}
      </div>
    </div>
  );
}

export function ConversationListChannelSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

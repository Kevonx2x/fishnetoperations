"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Home,
  MoreVertical,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/relative-time";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { getPeerUser, isSupportChannel } from "@/features/messaging/lib/channel-helpers";
import type { ChannelPropertyMetadata } from "@/features/messaging/types";
import { cn } from "@/lib/utils";
import { useChatContext } from "stream-chat-react";

function peerProfileHref(peerId: string, selfRole: string): string {
  if (selfRole === "agent" || selfRole === "broker" || selfRole === "team_member") {
    return `/clients/${encodeURIComponent(peerId)}`;
  }
  return `/agents/${encodeURIComponent(peerId)}`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function ContactAvatar(props: { image?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(props.image?.trim()) && !failed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={props.image}
        alt=""
        width={32}
        height={32}
        className={cn("size-8 shrink-0 rounded-full object-cover", props.className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E] text-xs font-semibold text-white",
        props.className,
      )}
      aria-hidden
    >
      {initialsFromName(props.name)}
    </span>
  );
}

type Props = {
  onBack: () => void;
  className?: string;
  onChromeHeightChange?: (height: number) => void;
};

/** Mobile-only conversation chrome — fixed contact row + optional property row. */
export function MobileThreadHeader(props: Props) {
  const { channel: activeChannel } = useChatContext();
  const { user, profile } = useAuth();
  const selfId = user?.id ?? "";
  const selfRole = profile?.role ?? "";
  const support = activeChannel ? isSupportChannel(activeChannel) : false;
  const chromeRef = useRef<HTMLDivElement>(null);
  const [chromeHeight, setChromeHeight] = useState(0);

  const channelData = activeChannel?.data as
    | { display_name?: string; display_avatar_url?: string; name?: string }
    | undefined;

  const streamPeer = activeChannel ? getPeerUser(activeChannel, selfId) : null;
  const peer = streamPeer
    ? {
        id: streamPeer.id ?? "",
        name: (streamPeer.name || streamPeer.id || "Conversation").trim(),
        image: (streamPeer.image || "").trim() || undefined,
        online: Boolean(streamPeer.online),
        lastActive: streamPeer.last_active
          ? new Date(streamPeer.last_active).toISOString()
          : null,
      }
    : null;

  const displayName = support
    ? (channelData?.display_name?.trim() || "BahayGo Support")
    : (peer?.name ?? (activeChannel ? "Conversation" : ""));

  const displayImage = support
    ? (channelData?.display_avatar_url?.trim() || "/apple-touch-icon.png")
    : peer?.image;

  const [peerIsVerifiedAgent, setPeerIsVerifiedAgent] = useState(false);

  const channelMeta = (activeChannel?.data ?? {}) as ChannelPropertyMetadata;
  const propertyId = (channelMeta.property_id ?? "").trim();
  const propertyName = (channelMeta.property_name ?? "").trim();
  const propertyPrice = (channelMeta.property_price ?? "").trim();
  const propertyImage = (channelMeta.property_image ?? "").trim();
  const showPropertyRow = !support && Boolean(propertyId && propertyName);

  const formattedPropertyPrice = useMemo(() => {
    if (!propertyPrice) return null;
    const cleaned = propertyPrice.replace(/^\$/u, "").trim();
    if (!cleaned) return null;
    return formatPropertyPriceDisplay(cleaned, undefined);
  }, [propertyPrice]);

  useEffect(() => {
    let cancelled = false;
    if (!peer?.id || selfRole === "agent" || selfRole === "broker" || selfRole === "team_member") {
      setPeerIsVerifiedAgent(false);
      return;
    }
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase
          .from("agents")
          .select("verification_status, verified")
          .eq("user_id", peer.id)
          .maybeSingle();
        if (cancelled) return;
        const isVerified =
          (data?.verification_status ?? "").toString().toLowerCase() === "verified" ||
          data?.verified === true;
        setPeerIsVerifiedAgent(isVerified);
      } catch {
        if (!cancelled) setPeerIsVerifiedAgent(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [peer?.id, selfRole]);

  const statusLine = useMemo(() => {
    if (support) return "We typically reply within a few hours";
    if (!peer) return "Loading…";
    if (peer.online) return "Online";
    if (peer.lastActive) return `Last seen ${formatRelativeTime(peer.lastActive)}`;
    return "Offline";
  }, [peer, support]);

  const statusIsOnline = Boolean(peer?.online);

  useLayoutEffect(() => {
    const el = chromeRef.current;
    if (!el) {
      setChromeHeight(0);
      props.onChromeHeightChange?.(0);
      return;
    }
    const report = () => {
      const h = el.getBoundingClientRect().height;
      setChromeHeight(h);
      props.onChromeHeightChange?.(h);
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeChannel, displayName, showPropertyRow, props.onChromeHeightChange]);

  const contactRow = (
    <div className="flex h-14 items-center gap-2 border-b border-black/[0.06] px-4">
      <button
        type="button"
        onClick={props.onBack}
        aria-label="Back to conversations"
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-[#2C2C2C] active:bg-black/[0.04]"
      >
        <ChevronLeft className="size-6" strokeWidth={2} aria-hidden />
      </button>
      <ContactAvatar image={displayImage} name={displayName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <p className="truncate text-base font-semibold leading-tight text-[#2C2C2C]">
            {displayName}
          </p>
          {peerIsVerifiedAgent ? (
            <BadgeCheck className="size-3.5 shrink-0 text-[#6B9E6E]" aria-hidden />
          ) : null}
        </div>
        <p
          className={cn(
            "truncate text-xs font-normal leading-tight",
            statusIsOnline ? "text-[#6B9E6E]" : "text-[#888888]",
          )}
        >
          {statusLine}
        </p>
      </div>
      {!support && (peer?.id || activeChannel) ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Conversation actions"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-[#2C2C2C] active:bg-black/[0.04]"
            >
              <MoreVertical className="size-6" strokeWidth={2} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            {peer?.id ? (
              <DropdownMenuItem asChild>
                <Link href={peerProfileHref(peer.id, selfRole)}>View profile</Link>
              </DropdownMenuItem>
            ) : null}
            {peer?.id ? (
              <DropdownMenuItem asChild>
                <a
                  href={`mailto:support@bahaygo.com?subject=${encodeURIComponent("Report a user")}&body=${encodeURIComponent(`Report regarding user ${peer.id}`)}`}
                >
                  Report
                </a>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem disabled>Block (coming soon)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="size-11 shrink-0" aria-hidden />
      )}
    </div>
  );

  if (!activeChannel) {
    return (
      <div className={cn("md:hidden", props.className)}>
        <div
          ref={chromeRef}
          className="fixed left-0 right-0 top-0 z-30 border-b border-black/[0.06] bg-white pt-[env(safe-area-inset-top,0px)] shadow-sm"
        >
          <div className="flex h-14 items-center px-4">
            <button
              type="button"
              onClick={props.onBack}
              aria-label="Back to conversations"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-[#2C2C2C] active:bg-black/[0.04]"
            >
              <ChevronLeft className="size-6" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
        <div className="shrink-0 md:hidden" style={{ height: chromeHeight }} aria-hidden />
      </div>
    );
  }

  return (
    <div className={cn("md:hidden", props.className)}>
      <div
        ref={chromeRef}
        className="fixed left-0 right-0 top-0 z-30 bg-white pt-[env(safe-area-inset-top,0px)] shadow-sm"
      >
        {contactRow}
        {showPropertyRow ? (
          <Link
            href={`/properties/${encodeURIComponent(propertyId)}`}
            className="flex items-center gap-3 border-y border-black/[0.06] bg-[#FAF8F4] px-4 py-3 active:bg-black/[0.02]"
          >
            {propertyImage ? (
              <span className="relative size-12 shrink-0 overflow-hidden rounded-md">
                <Image src={propertyImage} alt="" fill className="object-cover" sizes="48px" unoptimized />
              </span>
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-white text-[#6B9E6E] ring-1 ring-black/[0.06]">
                <Home className="size-5" aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-medium leading-snug text-[#2C2C2C]">
                {propertyName}
              </span>
              {formattedPropertyPrice ? (
                <span className="mt-0.5 block text-sm font-semibold text-[#6B9E6E]">
                  {formattedPropertyPrice}
                </span>
              ) : null}
            </span>
            <ChevronRight className="size-5 shrink-0 text-[#888888]" aria-hidden />
          </Link>
        ) : null}
      </div>
      <div className="shrink-0" style={{ height: chromeHeight }} aria-hidden />
    </div>
  );
}

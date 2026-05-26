"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  Home,
  MoreHorizontal,
} from "lucide-react";
import { Avatar, useChatContext } from "stream-chat-react";

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
import { isSupportChannel } from "@/features/messaging/lib/channel-helpers";
import type { ChannelPropertyMetadata, PeerInfo } from "@/features/messaging/types";
import { cn } from "@/lib/utils";

function getPeerFromMembers(params: {
  members:
    | Record<
        string,
        {
          user?: {
            id?: string;
            name?: string | null;
            image?: string | null;
            online?: boolean;
            last_active?: string | Date | null;
          };
        }
      >
    | undefined;
  selfId: string;
}): PeerInfo | null {
  const { members, selfId } = params;
  if (!members || !selfId) return null;

  for (const m of Object.values(members)) {
    const u = m.user;
    const id = u?.id;
    if (!id || id === selfId) continue;
    return {
      id,
      name: (u?.name || id).trim(),
      image: (u?.image || "").trim() || undefined,
      online: Boolean(u?.online),
      lastActive: u?.last_active ? new Date(u.last_active).toISOString() : null,
    };
  }

  return null;
}

function peerProfileHref(peerId: string, selfRole: string): string {
  if (selfRole === "agent" || selfRole === "broker" || selfRole === "team_member") {
    return `/clients/${encodeURIComponent(peerId)}`;
  }
  return `/agents/${encodeURIComponent(peerId)}`;
}

type Props = {
  onBack: () => void;
  className?: string;
};

/** Mobile-only conversation chrome — compact header + property row below. */
export function MobileThreadHeader(props: Props) {
  const { channel: activeChannel } = useChatContext();
  const { user, profile } = useAuth();
  const selfId = user?.id ?? "";
  const selfRole = profile?.role ?? "";
  const support = activeChannel ? isSupportChannel(activeChannel) : false;

  const peer = getPeerFromMembers({
    members: activeChannel?.state?.members as
      | Record<
          string,
          {
            user?: {
              id?: string;
              name?: string | null;
              image?: string | null;
              online?: boolean;
              last_active?: string | Date | null;
            };
          }
        >
      | undefined,
    selfId,
  });

  const [peerIsVerifiedAgent, setPeerIsVerifiedAgent] = useState(false);

  const channelMeta = (activeChannel?.data ?? {}) as ChannelPropertyMetadata;
  const propertyId = (channelMeta.property_id ?? "").trim();
  const propertyName = (channelMeta.property_name ?? "").trim();
  const propertyPrice = (channelMeta.property_price ?? "").trim();
  const propertyImage = (channelMeta.property_image ?? "").trim();

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
    if (!peer) return "Offline";
    if (peer.online) return "Online";
    if (peer.lastActive) return `Last seen ${formatRelativeTime(peer.lastActive)}`;
    return "Offline";
  }, [peer]);

  const statusIsOnline = Boolean(peer?.online);

  if (!activeChannel || !peer) {
    return (
      <div className={cn("md:hidden", props.className)}>
        <div className="sticky top-0 z-20 border-b border-black/[0.06] bg-white pt-[env(safe-area-inset-top,0px)] shadow-sm">
          <div className="flex h-14 items-center px-2">
            <button
              type="button"
              onClick={props.onBack}
              aria-label="Back to conversations"
              className="flex size-11 items-center justify-center rounded-lg text-[#2C2C2C] active:bg-black/[0.04]"
            >
              <ArrowLeft className="size-6" strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("shrink-0 md:hidden", props.className)}>
      <div className="sticky top-0 z-20 bg-white pt-[env(safe-area-inset-top,0px)] shadow-sm">
        <div className="flex h-14 items-center gap-2 border-b border-black/[0.06] px-2">
          <button
            type="button"
            onClick={props.onBack}
            aria-label="Back to conversations"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-[#2C2C2C] active:bg-black/[0.04]"
          >
            <ArrowLeft className="size-6" strokeWidth={2} aria-hidden />
          </button>
          <span className="relative shrink-0">
            <Avatar
              image={peer.image}
              name={peer.name}
              className="size-8 [&_.str-chat__avatar-fallback]:text-xs"
            />
            {peer.online ? (
              <span
                className="absolute bottom-0 right-0 size-2 rounded-full border-2 border-white bg-[#6B9E6E]"
                aria-hidden
              />
            ) : null}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-base font-semibold text-[#2C2C2C]">{peer.name}</p>
              {peerIsVerifiedAgent ? (
                <BadgeCheck className="size-3.5 shrink-0 text-[#6B9E6E]" aria-hidden />
              ) : null}
            </div>
            <p
              className={cn(
                "truncate text-xs font-normal",
                statusIsOnline ? "text-[#6B9E6E]" : "text-[#888888]",
              )}
            >
              {statusLine}
            </p>
          </div>
          {!support ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Conversation actions"
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-[#2C2C2C] active:bg-black/[0.04]"
                >
                  <MoreHorizontal className="size-6" strokeWidth={2} aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                <DropdownMenuItem asChild>
                  <Link href={peerProfileHref(peer.id, selfRole)}>View profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={`mailto:support@bahaygo.com?subject=${encodeURIComponent("Report a user")}&body=${encodeURIComponent(`Report regarding user ${peer.id}`)}`}
                  >
                    Report
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>Block (coming soon)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="size-11 shrink-0" aria-hidden />
          )}
        </div>

        {!support && propertyId && propertyName ? (
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
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Home } from "lucide-react";
import { Avatar, useChatContext } from "stream-chat-react";

import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/relative-time";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { cn } from "@/lib/utils";
import type { ChannelPropertyMetadata, PeerInfo } from "@/features/messaging/types";

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

export function ChatHeader(props: { onBack?: () => void; className?: string }) {
  const { channel: activeChannel } = useChatContext();
  const { user, profile } = useAuth();
  const selfId = user?.id ?? "";
  const selfRole = profile?.role ?? "";

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

  const formattedMobilePropertyPrice = useMemo(() => {
    if (!propertyPrice) return null;
    // Conversations reference rental properties; keep consistent with property detail formatting.
    return formatPropertyPriceDisplay(propertyPrice, "for_rent");
  }, [propertyPrice]);

  useEffect(() => {
    let cancelled = false;
    if (!peer?.id || selfRole === "agent") {
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

  const mobileOfflineLabel = useMemo(() => {
    if (!peer) return "Offline";
    if (peer.online) return "Online";
    if (peer.lastActive) return `Offline · last seen ${formatRelativeTime(peer.lastActive)}`;
    return "Offline";
  }, [peer]);

  if (!activeChannel || !peer) {
    return (
      <div className={cn("flex min-h-14 items-center gap-3 border-b border-subtle bg-surface-page px-4 py-3", props.className)}>
        {props.onBack ? (
          <button type="button" onClick={props.onBack} aria-label="Back to conversations">
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}
        <span className="text-sm font-semibold text-fg/45">Select a conversation</span>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-14 items-center gap-3 border-b border-subtle bg-surface-page px-4 py-3", props.className)}>
      {props.onBack ? (
        <button type="button" onClick={props.onBack} aria-label="Back to conversations">
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : null}
      <span className="relative">
        <Avatar image={peer.image} name={peer.name} className="h-8 w-8 [&_.str-chat__avatar-fallback]:text-sm" />
        {peer.online ? (
          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-brand-sage" aria-hidden />
        ) : null}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-lg font-bold text-fg">{peer.name}</p>
          {peerIsVerifiedAgent ? (
            <span className="inline-flex text-[#6B9E6E] md:hidden" title="Verified agent">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            </span>
          ) : null}
        </div>
        <p className="text-xs font-medium text-fg/50 md:hidden">{mobileOfflineLabel}</p>
        <p className="hidden text-xs font-medium text-fg/50 md:block">{peer.online ? "Online" : "Offline"}</p>
        {propertyId && propertyName ? (
          <Link
            href={`/properties/${encodeURIComponent(propertyId)}`}
            className="mt-2 flex max-w-[280px] items-center gap-2 rounded-lg border border-subtle bg-surface-panel px-2 py-1.5 md:hidden"
          >
            {propertyImage ? (
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
                <Image src={propertyImage} alt="" fill className="object-cover" sizes="40px" unoptimized />
              </span>
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#FAF8F4] text-[#6B9E6E]">
                <Home className="h-4 w-4" aria-hidden />
              </span>
            )}
            <span className="min-w-0">
              <span
                className="line-clamp-2 block overflow-hidden text-xs font-semibold leading-tight text-fg [display:-webkit-box] [WebkitBoxOrient:vertical] [WebkitLineClamp:2]"
              >
                {propertyName}
              </span>
              {formattedMobilePropertyPrice ? (
                <span className="mt-1 block truncate text-[11px] font-semibold text-[#D4A843]">
                  {formattedMobilePropertyPrice}
                </span>
              ) : null}
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}


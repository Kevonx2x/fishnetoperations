import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { Avatar, useChatContext } from "stream-chat-react";

import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { PeerInfo } from "@/features/messaging/types";

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
    <div
      className={cn(
        "hidden min-h-14 items-center gap-3 border-b border-subtle bg-surface-page px-4 py-3 md:flex",
        props.className,
      )}
    >
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
        <p className="text-xs font-medium text-fg/50">{peer.online ? "Online" : "Offline"}</p>
      </div>
    </div>
  );
}


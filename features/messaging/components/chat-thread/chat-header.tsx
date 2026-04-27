import { ArrowLeft } from "lucide-react";
import { Avatar, useChatContext } from "stream-chat-react";

import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import type { PeerInfo } from "@/features/messaging/types";

function getPeerFromMembers(params: {
  members: Record<string, { user?: { id?: string; name?: string | null; image?: string | null; online?: boolean } }> | undefined;
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
    };
  }

  return null;
}

export function ChatHeader(props: { onBack?: () => void; className?: string }) {
  const { channel: activeChannel } = useChatContext();
  const { user } = useAuth();
  const selfId = user?.id ?? "";

  const peer = getPeerFromMembers({
    members: activeChannel?.state?.members as
      | Record<string, { user?: { id?: string; name?: string | null; image?: string | null; online?: boolean } }>
      | undefined,
    selfId,
  });

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
        <p className="truncate text-lg font-bold text-fg">{peer.name}</p>
        <p className="text-xs font-medium text-fg/50">{peer.online ? "Online" : "Offline"}</p>
      </div>
    </div>
  );
}


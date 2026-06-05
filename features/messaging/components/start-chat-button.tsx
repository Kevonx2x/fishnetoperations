"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import type { CreateMessagingChannelErrorBody, CreateMessagingChannelResponse } from "@/features/messaging/types";
import { clientMessagesHref } from "@/lib/messenger/client-messages-path";
import { startMessengerConversation } from "@/lib/messenger/start-conversation-client";
import { cn } from "@/lib/utils";

const STREAM_CHANNEL_ENDPOINT = "/api/stream/channel";
const AGENT_DASHBOARD_PATH = "/dashboard/agent";
const DEFAULT_LABEL = "Message";

export type StreamChannelPropertyMetadata = {
  property_id: string | null;
  property_name: string | null;
  property_price: string | null;
  property_image: string | null;
};

type Props = {
  /** Agent auth user id (profiles.id / auth.users id), NOT agents table row id. */
  agentId: string;
  /** Client auth user id when the viewer is the agent. */
  clientId: string;
  className?: string;
  label?: string;
  metadata?: StreamChannelPropertyMetadata;
  /** When true, shows a message bubble icon before the label (e.g. client pipeline). */
  showMessageIcon?: boolean;
};

/**
 * Opens a conversation between a client and agent.
 * Clients → in-house messenger (`/dashboard/client/messages?c=`).
 * Agents → legacy Stream inbox on the agent dashboard.
 */
export function StartChatButton({
  agentId,
  clientId,
  className,
  label = DEFAULT_LABEL,
  metadata,
  showMessageIcon = false,
}: Props) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!user) {
      toast.error("Sign in to send a message.");
      return;
    }

    setBusy(true);
    try {
      if (profile?.role === "agent") {
        const res = await fetch(STREAM_CHANNEL_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_user_id: user.id,
            client_user_id: clientId,
            ...(metadata ? { metadata } : {}),
          }),
          credentials: "include",
        });
        const data: unknown = await res.json().catch(() => ({}));
        const okBody = data as CreateMessagingChannelResponse;
        const errBody = data as CreateMessagingChannelErrorBody;
        if (!res.ok || typeof okBody.channel_id !== "string" || !okBody.channel_id) {
          toast.error(typeof errBody.error === "string" ? errBody.error : "Could not open chat.");
          return;
        }
        const q = new URLSearchParams();
        q.set("channel", okBody.channel_id);
        q.set("tab", "messages");
        router.push(`${AGENT_DASHBOARD_PATH}?${q.toString()}`);
        return;
      }

      const result = await startMessengerConversation({
        otherUserId: agentId,
        propertyId: metadata?.property_id ?? undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.push(clientMessagesHref(result.conversationId));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-[#6B9E6E] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#5d8a60] disabled:opacity-60",
        className,
      )}
    >
      {busy ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
          Opening chat…
        </>
      ) : (
        <>
          {showMessageIcon ? <MessageCircle className="h-4 w-4 shrink-0 opacity-95" aria-hidden /> : null}
          {label}
        </>
      )}
    </button>
  );
}

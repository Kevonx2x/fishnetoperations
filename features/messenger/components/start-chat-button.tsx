"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { agentMessagesHref } from "@/lib/agent-messages-path";
import { clientMessagesHref } from "@/lib/messenger/client-messages-path";
import { startMessengerConversation } from "@/lib/messenger/start-conversation-client";
import { cn } from "@/lib/utils";

const DEFAULT_LABEL = "Message";

export type MessagePropertyMetadata = {
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
  metadata?: MessagePropertyMetadata;
  /** When true, shows a message bubble icon before the label (e.g. client pipeline). */
  showMessageIcon?: boolean;
};

/**
 * Opens an in-house messenger conversation between a client and agent.
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
      const otherUserId = profile?.role === "agent" ? clientId : agentId;
      const result = await startMessengerConversation({
        otherUserId,
        propertyId: metadata?.property_id ?? undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (profile?.role === "agent") {
        router.push(agentMessagesHref(result.conversationId));
      } else {
        router.push(clientMessagesHref(result.conversationId));
      }
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

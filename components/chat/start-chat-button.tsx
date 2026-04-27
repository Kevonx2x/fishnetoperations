"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const STREAM_CHANNEL_ENDPOINT = "/api/stream/channel";
const CLIENT_MESSAGES_PATH = "/dashboard/client/messages";
const AGENT_DASHBOARD_PATH = "/dashboard/agent";
const DEFAULT_LABEL = "Message";

export type StreamChannelPropertyMetadata = {
  property_id: string | null;
  property_name: string | null;
  property_price: string | null;
  property_image: string | null;
};

type Props = {
  agentId: string;
  clientId: string;
  className?: string;
  label?: string;
  metadata?: StreamChannelPropertyMetadata;
};

/**
 * Starts (or opens) a Stream Chat channel between a client and agent,
 * then routes to the correct messaging UI with that channel selected.
 */
export function StartChatButton({
  agentId,
  clientId,
  className,
  label = DEFAULT_LABEL,
  metadata,
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
      const res = await fetch(STREAM_CHANNEL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          client_id: clientId,
          ...(metadata ? { metadata } : {}),
        }),
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { channel_id?: string; error?: string };
      if (!res.ok || !data.channel_id) {
        toast.error(data.error ?? "Could not open chat.");
        return;
      }
      const q = new URLSearchParams();
      q.set("channel", data.channel_id);
      if (profile?.role === "agent") {
        q.set("tab", "messages");
        router.push(`${AGENT_DASHBOARD_PATH}?${q.toString()}`);
      } else {
        router.push(`${CLIENT_MESSAGES_PATH}?${q.toString()}`);
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
        "inline-flex items-center justify-center rounded-full bg-[#6B9E6E] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#5d8a60] disabled:opacity-60",
        className,
      )}
    >
      {busy ? "Opening…" : label}
    </button>
  );
}

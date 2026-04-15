"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

type Props = {
  agentId: string;
  clientId: string;
  className?: string;
  label?: string;
};

export function StartChatButton({
  agentId,
  clientId,
  className,
  label = "Message",
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
      const res = await fetch("/api/stream/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, client_id: clientId }),
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as { channel_id?: string; error?: string };
      if (!res.ok || !data.channel_id) {
        toast.error(data.error ?? "Could not open chat.");
        return;
      }
      const q = new URLSearchParams();
      q.set("tab", "messages");
      q.set("channel", data.channel_id);
      if (profile?.role === "agent") {
        router.push(`/dashboard/agent?${q.toString()}`);
      } else {
        router.push(`/clients/${encodeURIComponent(user.id)}?${q.toString()}`);
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

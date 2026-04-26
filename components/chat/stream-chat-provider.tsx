"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { StreamChat } from "stream-chat";
import { useAuth } from "@/contexts/auth-context";

const StreamChatContext = createContext<StreamChat | null>(null);

let cachedToken: string | null = null;
let cachedTokenUserId: string | null = null;

export function StreamChatProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [client, setClient] = useState<StreamChat | null>(null);

  useEffect(() => {
    if (authLoading || !user?.id) {
      setClient(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      let token = cachedTokenUserId === user.id ? cachedToken : null;
      if (!token) {
        const res = await fetch("/api/stream/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user.id }),
          credentials: "include",
        });

        if (!res.ok || cancelled) return;
        const data = (await res.json().catch(() => null)) as { token?: string };
        if (!data?.token || cancelled) return;
        token = data.token;
        cachedToken = token;
        cachedTokenUserId = user.id;
      }

      const apiKey = process.env.NEXT_PUBLIC_STREAM_API?.trim();
      if (!apiKey) {
        console.error("Missing NEXT_PUBLIC_STREAM_API");
        return;
      }

      const chat = StreamChat.getInstance(apiKey);
      const displayName = profile?.full_name?.trim() || user.email || "User";
      const image = profile?.avatar_url?.trim() || undefined;
      const streamUser = { id: user.id, name: displayName, image };

      if (chat.userID && chat.userID !== user.id) {
        await chat.disconnectUser();
      }
      if (chat.userID === user.id) {
        await chat.upsertUser(streamUser);
      } else {
        await chat.connectUser(streamUser, token);
      }
      if (!cancelled) setClient(chat);
    })();

    return () => {
      cancelled = true;
      setClient(null);
    };
  }, [authLoading, user?.id, user?.email, profile?.full_name, profile?.avatar_url]);

  return <StreamChatContext.Provider value={client}>{children}</StreamChatContext.Provider>;
}

export function useStreamChat() {
  return useContext(StreamChatContext);
}

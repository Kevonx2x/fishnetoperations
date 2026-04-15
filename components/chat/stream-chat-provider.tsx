"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { StreamChat } from "stream-chat";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const StreamChatContext = createContext<StreamChat | null>(null);

let cachedToken: string | null = null;
let cachedTokenUserId: string | null = null;

export function StreamChatProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const supabase = useRef(createSupabaseBrowserClient()).current;
  const [client, setClient] = useState<StreamChat | null>(null);
  const clientRef = useRef<StreamChat | null>(null);

  useEffect(() => {
    if (authLoading || !user?.id) {
      setClient(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

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
      if (chat.userID !== user.id) {
        await chat.connectUser(
          {
            id: user.id,
            name: (profile?.full_name as string | undefined)?.trim() || user.email || "User",
            image: (profile?.avatar_url as string | undefined)?.trim() || undefined,
          },
          token,
        );
      }
      clientRef.current = chat;
      if (!cancelled) setClient(chat);
    })();

    return () => {
      cancelled = true;
      clientRef.current = null;
      setClient(null);
    };
  }, [authLoading, user?.id, user?.email, supabase]);

  return <StreamChatContext.Provider value={client}>{children}</StreamChatContext.Provider>;
}

export function useStreamChat() {
  return useContext(StreamChatContext);
}

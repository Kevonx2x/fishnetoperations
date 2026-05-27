"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { StreamChat } from "stream-chat";

import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createBrowserStreamClient } from "@/features/messaging/lib/stream-client";

const StreamChatContext = createContext<StreamChat | null>(null);

let cachedToken: string | null = null;
let cachedTokenUserId: string | null = null;

/** Stream Chat only on messaging routes — keeps homepage bfcache-eligible. */
function useStreamChatRouteEnabled(): boolean {
  const pathname = usePathname() ?? "";
  return (
    pathname.startsWith("/messages") ||
    pathname.startsWith("/dashboard/agent") ||
    pathname.startsWith("/dashboard/client/messages")
  );
}

export function StreamChatProvider({ children }: { children: React.ReactNode }) {
  const routeEnabled = useStreamChatRouteEnabled();
  const { user, profile, loading: authLoading } = useAuth();
  const [client, setClient] = useState<StreamChat | null>(null);
  const clientRef = useRef<StreamChat | null>(null);

  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  useEffect(() => {
    if (!routeEnabled || authLoading || !user?.id) {
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

      const chat = createBrowserStreamClient();
      const displayName = profile?.full_name?.trim() || user.email || "User";
      let image = profile?.avatar_url?.trim() || undefined;

      if (!image && profile?.role === "agent") {
        try {
          const supabase = createSupabaseBrowserClient();
          const { data: agentRow } = await supabase
            .from("agents")
            .select("image_url")
            .eq("user_id", user.id)
            .maybeSingle();
          image = (agentRow?.image_url as string | null | undefined)?.trim() || undefined;
        } catch {
          /* ignore */
        }
      }

      const streamUser = { id: user.id, name: displayName, image };

      if (chat.userID && chat.userID !== user.id) await chat.disconnectUser();
      if (chat.userID === user.id) await chat.upsertUser(streamUser);
      else await chat.connectUser(streamUser, token);

      if (!cancelled) setClient(chat);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    profile?.avatar_url,
    profile?.full_name,
    profile?.role,
    routeEnabled,
    user?.email,
    user?.id,
  ]);

  useEffect(() => {
    const onPageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
    };

    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !routeEnabled || !clientRef.current?.userID) return;
      setClient(clientRef.current);
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [routeEnabled]);

  return <StreamChatContext.Provider value={client}>{children}</StreamChatContext.Provider>;
}

export function useStreamChat() {
  return useContext(StreamChatContext);
}

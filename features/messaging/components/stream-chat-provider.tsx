"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { StreamChat } from "stream-chat";

import { useAuth } from "@/contexts/auth-context";
import { createBrowserStreamClient } from "@/features/messaging/lib/stream-client";

const StreamChatContext = createContext<StreamChat | null>(null);

let cachedToken: string | null = null;
let cachedTokenUserId: string | null = null;
/** Skip redundant Stream `upsertUser` calls (rate limit code 9). */
let lastUpsertedProfileKey: string | null = null;
let connectGeneration = 0;

/** Stream Chat only on messaging routes — not pipeline/overview (avoids token fetch noise). */
function useStreamChatRouteEnabled(): boolean {
  const pathname = usePathname() ?? "";
  return (
    pathname.startsWith("/messages") ||
    pathname === "/dashboard/client/messages" ||
    pathname.startsWith("/dashboard/client/messages/")
  );
}

function streamProfileKey(userId: string, name: string, image?: string): string {
  return `${userId}|${name}|${image ?? ""}`;
}

export function StreamChatProvider({ children }: { children: React.ReactNode }) {
  const routeEnabled = useStreamChatRouteEnabled();
  const { user, profile, loading: authLoading } = useAuth();
  const [client, setClient] = useState<StreamChat | null>(null);
  const clientRef = useRef<StreamChat | null>(null);

  const streamProfile = useMemo(() => {
    if (!user?.id) return null;
    const name = profile?.full_name?.trim() || user.email || "User";
    const image = profile?.avatar_url?.trim() || undefined;
    return { id: user.id, name, image, role: profile?.role };
  }, [user?.id, user?.email, profile?.avatar_url, profile?.full_name, profile?.role]);

  const profileKey = useMemo(
    () => (streamProfile ? streamProfileKey(streamProfile.id, streamProfile.name, streamProfile.image) : ""),
    [streamProfile],
  );

  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  useEffect(() => {
    if (!routeEnabled || !user?.id) {
      connectGeneration += 1;
      lastUpsertedProfileKey = null;
      setClient(null);
      return;
    }

    if (authLoading || !streamProfile) return;

    const generation = ++connectGeneration;
    let cancelled = false;

    const chat = createBrowserStreamClient();
    if (chat.userID === user.id) {
      setClient((prev) => prev ?? chat);
    }

    void (async () => {
      try {
        let token = cachedTokenUserId === user.id ? cachedToken : null;
        if (!token) {
          const res = await fetch("/api/stream/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: user.id }),
            credentials: "include",
          });
          if (!res.ok || cancelled || generation !== connectGeneration) return;
          const data = (await res.json().catch(() => null)) as { token?: string };
          if (!data?.token || cancelled || generation !== connectGeneration) return;
          token = data.token;
          cachedToken = token;
          cachedTokenUserId = user.id;
        }

        if (cancelled || generation !== connectGeneration) return;

        if (chat.userID && chat.userID !== user.id) {
          await chat.disconnectUser();
          lastUpsertedProfileKey = null;
        }

        const image = streamProfile.image;
        const streamUser = { id: user.id, name: streamProfile.name, image };
        const key = streamProfileKey(user.id, streamUser.name, streamUser.image);

        if (chat.userID === user.id) {
          if (lastUpsertedProfileKey !== key) {
            await chat.upsertUser(streamUser);
            lastUpsertedProfileKey = key;
          }
        } else {
          await chat.connectUser(streamUser, token);
          lastUpsertedProfileKey = key;
        }

        if (!cancelled && generation === connectGeneration) {
          setClient((prev) => (prev === chat ? prev : chat));
        }

        if (!cancelled && generation === connectGeneration && !image && streamProfile.role === "agent") {
          void (async () => {
            try {
              const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
              const supabase = createSupabaseBrowserClient();
              const { data: agentRow } = await supabase
                .from("agents")
                .select("image_url")
                .eq("user_id", user.id)
                .maybeSingle();
              const agentImage = (agentRow?.image_url as string | null | undefined)?.trim();
              if (!agentImage || cancelled || generation !== connectGeneration) return;
              const nextKey = streamProfileKey(user.id, streamUser.name, agentImage);
              if (lastUpsertedProfileKey === nextKey) return;
              await chat.upsertUser({ id: user.id, name: streamUser.name, image: agentImage });
              lastUpsertedProfileKey = nextKey;
            } catch {
              /* ignore background avatar sync */
            }
          })();
        }
      } catch (err) {
        console.error("[StreamChatProvider] connect failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, profileKey, routeEnabled, streamProfile, user?.id]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !routeEnabled || !clientRef.current?.userID) return;
      setClient((prev) => prev ?? clientRef.current);
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [routeEnabled]);

  return <StreamChatContext.Provider value={client}>{children}</StreamChatContext.Provider>;
}

export function useStreamChat() {
  return useContext(StreamChatContext);
}

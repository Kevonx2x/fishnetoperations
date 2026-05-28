"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isMessagesThreadOpen } from "@/lib/messages-mobile-chrome";
import { ChevronLeft, Loader2 } from "lucide-react";

import { AgentMessagesInbox } from "@/features/messaging/components/agent-messages-inbox";
import { ClientMessagesView } from "@/features/messaging/components/client-messages-view";
import { StreamChatProvider } from "@/features/messaging/components/stream-chat-provider";
import { useAuth } from "@/contexts/auth-context";

function MessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, role, loading } = useAuth();
  const channel = searchParams.get("channel");
  const showThreadChrome = isMessagesThreadOpen("/messages", channel);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/auth/login?next=${encodeURIComponent("/messages")}`);
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <div className="bahaygo-messaging-light flex min-h-screen items-center justify-center bg-[#FAF8F4]">
        <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Loading" />
      </div>
    );
  }

  const isAgentRole =
    role === "agent" || role === "broker" || role === "team_member";

  return (
    <div className="bahaygo-messaging-light flex min-h-[100vh] min-h-dvh h-dvh max-h-dvh flex-col overflow-hidden bg-[#FAF8F4] md:min-h-screen md:h-dvh md:max-h-dvh">
      {!showThreadChrome ? (
        <header className="shrink-0 border-b border-black/[0.06] bg-[#FAF8F4]/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm md:hidden">
          <div className="px-4 py-3">
            <Link
              href={isAgentRole ? "/dashboard/agent" : "/"}
              className="mb-2 inline-flex min-h-10 items-center gap-1 rounded-lg pr-2 text-sm font-semibold text-[#6B9E6E] transition-colors hover:text-[#5d8a60] active:opacity-80"
            >
              <ChevronLeft className="size-5 shrink-0" aria-hidden />
              {isAgentRole ? "Dashboard" : "Home"}
            </Link>
            <h1 className="font-serif text-2xl font-semibold leading-tight text-[#2C2C2C]">
              Messages
            </h1>
          </div>
        </header>
      ) : null}
      <div
        className={
          showThreadChrome
            ? "flex min-h-0 flex-1 flex-col overflow-hidden max-md:pb-0"
            : "flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]"
        }
      >
        {isAgentRole ? (
          <AgentMessagesInbox
            initialChannelId={channel}
            suppressMobileListHeader
            setActiveChannelOnMount={false}
          />
        ) : (
          <ClientMessagesView initialChannelId={channel} />
        )}
      </div>
    </div>
  );
}

/** Unified BahayGo inbox — agents, clients, and bottom-nav Inbox tab. */
export default function MessagesPage() {
  return (
    <StreamChatProvider>
      <Suspense fallback={null}>
        <MessagesPageContent />
      </Suspense>
    </StreamChatProvider>
  );
}

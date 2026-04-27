"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ChannelFilters, ChannelSort } from "stream-chat";
import { Chat, useChatContext } from "stream-chat-react";

import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { ConversationListPanel } from "@/features/messaging/components/conversation-list";
import { ChatThreadPanel } from "@/features/messaging/components/chat-thread";
import { ContextPanel } from "@/features/messaging/components/context-panel";
import { useActiveConversation } from "@/features/messaging/hooks/use-active-conversation";

export type MessagingInboxProps = {
  filters: ChannelFilters;
  sort: ChannelSort;
  /** Root grid area: height, overflow, background, columns */
  layoutClassName?: string;
  /** When false, first channel is selected on desktop via query (client pattern). */
  setActiveChannelOnMount?: boolean;
  /** Custom channel id (not cid) to select when opening from a deep link. */
  initialChannelId?: string | null;
  /** Enables the rich property context panel in the right sidebar. */
  showConversationContextPanel?: boolean;
};

export function MessagingInbox({
  filters,
  sort,
  layoutClassName = "flex h-[calc(100dvh-12rem)] w-full min-h-0 flex-1 flex-col overflow-hidden bg-surface-page md:h-full md:max-h-full md:min-h-0 md:grid md:grid-cols-[320px_minmax(0,1fr)_300px]",
  setActiveChannelOnMount = true,
  initialChannelId = null,
  showConversationContextPanel = false,
}: MessagingInboxProps) {
  const { user } = useAuth();
  const { client } = useChatContext();

  const [isDesktop, setIsDesktop] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [channelLoading, setChannelLoading] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const fn = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const { activeChannel, clearActiveConversation } = useActiveConversation({
    filters,
    sort,
    initialChannelId,
    setActiveChannelOnMount,
    isDesktop,
  });

  // When selecting a channel on mobile, show a small loading pulse then switch view.
  useEffect(() => {
    if (isDesktop) return;
    if (activeChannel) {
      setChannelLoading(true);
      window.setTimeout(() => setMobileView("thread"), 250);
      window.setTimeout(() => setChannelLoading(false), 650);
    }
  }, [activeChannel, isDesktop]);

  const selfUserId = user?.id ?? "";

  const layout = useMemo(() => cn(layoutClassName), [layoutClassName]);

  if (!client || !selfUserId) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-fg/10 bg-surface-panel font-sans text-sm font-medium text-fg/55">
        Loading messages…
      </div>
    );
  }

  return (
    <div className="bahaygo-stream-chat flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-surface-page">
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <Chat client={client} theme="messaging light">
          <div className={layout}>
            <div className={mobileView === "thread" ? "max-md:hidden" : ""}>
              <ConversationListPanel
                filters={filters}
                sort={sort}
                selfUserId={selfUserId}
                setActiveChannelOnMount={setActiveChannelOnMount}
                variant={isDesktop ? "desktop" : "mobile"}
              />
            </div>

            <div className={cn("flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden", mobileView === "list" ? "max-md:hidden" : "")}>
              <ChatThreadPanel
                channelLoading={channelLoading}
                onLoaded={() => setChannelLoading(false)}
                onBackToList={() => {
                  clearActiveConversation();
                  setMobileView("list");
                }}
              />
            </div>

            <aside
              className="hidden h-full max-h-full min-h-0 w-[300px] shrink-0 flex-col border-l border-subtle bg-surface-page max-md:hidden md:flex"
              aria-label="Conversation sidebar"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {showConversationContextPanel ? (
                  <ContextPanel channel={activeChannel ?? undefined} />
                ) : null}
              </div>
            </aside>
          </div>
        </Chat>
      </div>
    </div>
  );
}


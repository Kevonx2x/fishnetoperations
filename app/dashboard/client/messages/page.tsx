"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StreamChatProvider } from "@/features/messaging/components/stream-chat-provider";
import { ClientMessagesView } from "@/features/messaging/components/client-messages-view";

function MessagesInner() {
  const searchParams = useSearchParams();
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <StreamChatProvider>
        <ClientMessagesView initialChannelId={searchParams.get("channel")} />
      </StreamChatProvider>
    </div>
  );
}

export default function ClientDashboardMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-2xl border border-[#2C2C2C]/10 bg-white text-sm text-[#2C2C2C]/50">
          Loading messages…
        </div>
      }
    >
      <MessagesInner />
    </Suspense>
  );
}

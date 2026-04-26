"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StreamChatProvider } from "@/components/chat/stream-chat-provider";
import { ClientChatView } from "@/components/chat/client-chat-view";

function MessagesInner() {
  const searchParams = useSearchParams();
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <StreamChatProvider>
        <ClientChatView initialChannelId={searchParams.get("channel")} />
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

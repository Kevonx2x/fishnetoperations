"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StreamChatProvider } from "@/components/chat/stream-chat-provider";
import { ClientChatView } from "@/components/chat/client-chat-view";

function MessagesInner() {
  const searchParams = useSearchParams();
  return (
    <div className="mt-6 h-[min(640px,calc(100dvh-14rem))] w-full min-h-[400px] md:h-[600px]">
      <StreamChatProvider>
        <ClientChatView initialChannelId={searchParams.get("channel")} />
      </StreamChatProvider>
    </div>
  );
}

export default function ClientDashboardMessagesPage() {
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#2C2C2C] md:text-4xl">
        Messages
      </h1>
      <p className="mt-2 max-w-2xl text-sm font-medium text-[#888888] md:text-base">
        Chat with agents you&apos;ve connected with on BahayGo.
      </p>
      <Suspense
        fallback={
          <div className="mt-6 flex h-96 items-center justify-center rounded-2xl border border-[#2C2C2C]/10 bg-white text-sm text-[#2C2C2C]/50">
            Loading messages…
          </div>
        }
      >
        <MessagesInner />
      </Suspense>
    </>
  );
}

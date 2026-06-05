"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { MessengerClientHost } from "@/features/messenger/components/messenger-client-host";

function MessagesLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-[#FAF8F4]">
      <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Loading messages" />
    </div>
  );
}

export default function ClientDashboardMessagesPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense fallback={<MessagesLoading />}>
        <MessengerClientHost />
      </Suspense>
    </div>
  );
}

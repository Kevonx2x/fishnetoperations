"use client";

import { MessengerClientHost } from "@/features/messenger/components/messenger-client-host";

export default function ClientDashboardMessagesPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <MessengerClientHost />
    </div>
  );
}

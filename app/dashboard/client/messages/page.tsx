"use client";

import { MessengerCore } from "@/features/messenger/components/messenger-core";
import {
  DEFAULT_CONVERSATION_ID,
  MOCK_CONVERSATIONS,
} from "@/features/messenger/mock-data";

export default function ClientDashboardMessagesPage() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <MessengerCore
        conversations={MOCK_CONVERSATIONS}
        defaultConversationId={DEFAULT_CONVERSATION_ID}
      />
    </div>
  );
}

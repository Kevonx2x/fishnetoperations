"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { useMessengerUnreadTotal } from "@/features/messenger/hooks/use-messenger-unread-total";
import { BAHAYGO_CARD, BAHAYGO_CARD_HOVER, BAHAYGO_TEXT_TERTIARY } from "@/lib/bahaygo-typography";

export function ClientDashboardUnreadMessagesStatTile() {
  const { user } = useAuth();
  const total = useMessengerUnreadTotal(user?.id);

  const numLabel = String(total);
  const subline =
    total === 0 ? "All caught up" : `${total} unread message${total === 1 ? "" : "s"}`;

  return (
    <Link
      href="/dashboard/client/messages"
      className={`flex p-4 ${BAHAYGO_CARD} ${BAHAYGO_CARD_HOVER}`}
    >
      <div className="flex w-full min-w-0 items-start gap-2.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/10">
          <MessageSquare className="size-5 text-[#6B9E6E]" aria-hidden />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-2xl font-semibold leading-tight tracking-tight text-[#2C2C2C]">{numLabel}</p>
          <p className="mt-0.5 text-sm font-medium text-[#2C2C2C]">Unread messages</p>
          <p className={`mt-1 text-xs font-normal ${BAHAYGO_TEXT_TERTIARY}`}>{subline}</p>
        </div>
      </div>
    </Link>
  );
}

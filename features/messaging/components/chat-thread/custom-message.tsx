import Link from "next/link";
import { useMemo } from "react";
import { Home } from "lucide-react";
import { Attachment, Avatar, MessageText, useChannelStateContext, useMessageContext } from "stream-chat-react";

import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { messageGapForIndex } from "@/features/messaging/lib/message-grouping";
import type { ChannelPropertyMetadata } from "@/features/messaging/types";

export function CustomMessage() {
  const { messages: channelMessages, channel } = useChannelStateContext("CustomMessage");
  const { isMyMessage, message, groupStyles, firstOfGroup, readBy, deliveredTo } = useMessageContext();
  const { profile } = useAuth();
  const mine = isMyMessage();

  const createdAt = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
  const showName =
    !mine &&
    Boolean(message.user?.name) &&
    (firstOfGroup || groupStyles?.includes("top") || groupStyles?.includes("single"));
  /** Always show peer avatar on every bubble (Stream grouping hides avatars on middle/bottom by default). */
  const showAvatar = !mine;
  const tight = Boolean(groupStyles?.includes("middle") || groupStyles?.includes("bottom"));

  const gap = useMemo(
    () =>
      messageGapForIndex({
        messages: channelMessages,
        messageId: message.id,
        currentSenderId: message.user?.id,
      }),
    [channelMessages, message.id, message.user?.id],
  );

  const finalAttachments = useMemo(() => {
    if (!message.shared_location && !message.attachments?.length) return [];
    if (!message.shared_location) return message.attachments ?? [];
    return [message.shared_location, ...(message.attachments ?? [])];
  }, [message.attachments, message.shared_location]);

  const myId = message.user?.id;
  const othersRead = mine && (readBy ?? []).some((u) => u.id && u.id !== myId);
  const othersDelivered = mine && (deliveredTo ?? []).some((u) => u.id && u.id !== myId);
  let readReceipt: string | null = null;
  if (mine && createdAt) {
    if (othersRead) readReceipt = "✓✓";
    else if (othersDelivered || message.status === "received" || message.status === "sent") readReceipt = "✓";
  }

  const roleLabel = mine ? (profile?.role === "agent" ? "Agent" : "Client") : profile?.role === "agent" ? "Client" : "Agent";
  const showRoleLabel = Boolean(firstOfGroup || groupStyles?.includes("top") || groupStyles?.includes("single"));

  const channelMeta = (channel?.data ?? {}) as ChannelPropertyMetadata;
  const propertyIdFromMeta = String((message as Record<string, unknown>).property_id ?? "").trim();
  const propertyNameFromMeta = String((message as Record<string, unknown>).property_name ?? "").trim();
  const propertyPriceFromMeta = String((message as Record<string, unknown>).property_price ?? "").trim();
  const propertyImageFromMeta = String((message as Record<string, unknown>).property_image ?? "").trim();
  const text = String(message.text ?? "");
  const propertyMatch = text.match(/(?:https?:\/\/[^\s]+)?\/properties\/([A-Za-z0-9_-]+)/i);
  const propertyId = propertyIdFromMeta || (propertyMatch?.[1] ?? "").trim();
  const propertyName =
    propertyNameFromMeta ||
    String((message as Record<string, unknown>).property_title ?? "").trim() ||
    String(channelMeta.property_name ?? "").trim();
  const propertyPrice =
    propertyPriceFromMeta || String(channelMeta.property_price ?? "").trim();
  const propertyImage =
    propertyImageFromMeta || String(channelMeta.property_image ?? "").trim();

  return (
    <div
      className={cn(
        "bhg-msg",
        mine ? "bhg-msg--mine" : "bhg-msg--other",
        tight && "bhg-msg--tight",
        gap === "start" && "bhg-msg--gap-start",
        gap === "same" && "bhg-msg--gap-same",
        gap === "turn" && "bhg-msg--gap-turn",
        !mine && "pl-0",
        "w-full",
      )}
    >
      {!mine && showAvatar ? (
        <div className="h-9 w-9 shrink-0">
          <Avatar
            className="h-9 w-9 [&_.str-chat__avatar-fallback]:text-sm"
            image={message.user?.image}
            name={message.user?.name || message.user?.id}
          />
        </div>
      ) : null}
      <div className="bhg-msg__body">
        {showRoleLabel ? <span className="mb-0.5 block text-xs text-[#888888] md:hidden">{roleLabel}</span> : null}
        {showName ? <span className="bhg-msg__name">{message.user?.name}</span> : null}
        <div className="bhg-msg__bubble">
          {finalAttachments.length > 0 && !message.quoted_message ? (
            <Attachment attachments={finalAttachments} />
          ) : null}
          <MessageText />
          {propertyId ? (
            <Link
              href={`/properties/${encodeURIComponent(propertyId)}`}
              className="mt-2 flex items-center gap-2 rounded-lg border border-subtle bg-surface-panel p-2 md:hidden"
            >
              {propertyImage ? (
                <img src={propertyImage} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#FAF8F4] text-[#6B9E6E]">
                  <Home className="h-4 w-4" aria-hidden />
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-fg">{propertyName || "View property"}</span>
                {propertyPrice ? (
                  <span className="block truncate text-[11px] font-semibold text-[#D4A843]">{propertyPrice}</span>
                ) : null}
              </span>
            </Link>
          ) : null}
        </div>
        {createdAt ? (
          <span className="bhg-msg__time">
            {createdAt}
            {readReceipt ? <span className="bhg-msg__receipt"> {readReceipt}</span> : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}


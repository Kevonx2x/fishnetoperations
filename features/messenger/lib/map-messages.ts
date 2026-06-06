import type { MessengerMessage } from "../types";
import type { DbMessage } from "./db-types";
import { formatDateDivider, formatMessageTime } from "./format";

export function mapDbMessageToUi(
  row: DbMessage,
  currentUserId: string,
  peerLastReadAt: string | null | undefined,
): MessengerMessage {
  const sent = row.sender_id === currentUserId;
  const read =
    sent && peerLastReadAt
      ? new Date(peerLastReadAt).getTime() >= new Date(row.created_at).getTime()
      : false;

  return {
    id: row.id,
    text: row.body ?? "",
    attachmentUrl: row.attachment_url,
    sent,
    time: formatMessageTime(row.created_at),
    read: sent ? read : undefined,
  };
}

export function mapDbMessagesToUi(
  rows: DbMessage[],
  currentUserId: string,
  peerLastReadAt: string | null | undefined,
): MessengerMessage[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const out: MessengerMessage[] = [];
  let lastDayKey = "";

  for (const row of sorted) {
    const dayKey = row.created_at.slice(0, 10);
    if (dayKey !== lastDayKey) {
      lastDayKey = dayKey;
      out.push({
        id: `divider-${dayKey}`,
        text: "",
        sent: false,
        time: "",
        dateDivider: formatDateDivider(row.created_at),
      });
    }
    out.push(mapDbMessageToUi(row, currentUserId, peerLastReadAt));
  }

  return out;
}

export type OptimisticMessageInput = {
  text?: string;
  attachmentUrl?: string;
};

export function createOptimisticMessage(input: OptimisticMessageInput): MessengerMessage {
  const now = new Date();
  return {
    id: `optimistic-${now.getTime()}`,
    text: input.text?.trim() ?? "",
    attachmentUrl: input.attachmentUrl,
    sent: true,
    time: formatMessageTime(now),
    read: false,
    pending: true,
  };
}

export function optimisticMessageMatchesRow(message: MessengerMessage, row: DbMessage): boolean {
  if (!message.pending) return false;
  const msgBody = message.text?.trim() ?? "";
  const rowBody = (row.body ?? "").trim();
  const msgAttach = message.attachmentUrl?.trim() ?? "";
  const rowAttach = (row.attachment_url ?? "").trim();
  return msgBody === rowBody && msgAttach === rowAttach;
}

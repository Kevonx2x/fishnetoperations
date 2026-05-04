import type { Channel as StreamChannel, ChannelFilters, ChannelSort, LocalMessage } from "stream-chat";
import type { ReactNode } from "react";

export function msFromDateLike(d: unknown): number {
  if (!d) return 0;
  if (d instanceof Date) return d.getTime();
  const t = new Date(String(d)).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function isChannelPinned(ch: StreamChannel): boolean {
  return Boolean(ch.state?.membership?.pinned_at);
}

export function isChannelArchived(ch: StreamChannel): boolean {
  return Boolean(ch.state?.membership?.archived_at);
}

/** BahayGo Support 1:1 channel (pinned in UI). */
export function isSupportChannel(channel: StreamChannel | undefined): boolean {
  if (!channel) return false;
  const data = channel.data as Record<string, unknown> | undefined;
  if (data?.is_support === true) return true;
  const id = channel.id ?? (typeof data?.id === "string" ? data.id : undefined);
  return typeof id === "string" && id.startsWith("support_");
}

export function getPeerUser(channel: StreamChannel | undefined, selfId: string) {
  const members = channel?.state?.members;
  if (!members) return null;
  for (const m of Object.values(members)) {
    const id = m.user?.id;
    if (id && id !== selfId) return m.user ?? null;
  }
  return null;
}

export function previewPlainText(preview: ReactNode, lastMessage?: LocalMessage) {
  const t = lastMessage?.text?.trim();
  if (t) return t;
  if (typeof preview === "string" || typeof preview === "number") return String(preview);
  return "";
}

export type ChannelListQueryConfig = {
  filters: ChannelFilters;
  sort: ChannelSort;
};


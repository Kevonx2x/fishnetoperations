import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Channel, Event } from "stream-chat";
import { useChatContext } from "stream-chat-react";

export type UseActiveConversationParams = {
  /**
   * Optional deep link value (from UI integration). The URL `?channel=` is the primary source;
   * this value is a fallback when search params are not yet available to the hook.
   */
  initialChannelParam: string | null;
};

/** Stream client emits this after `ChannelList` (and other callers) finish a channel query batch. */
const CHANNELS_QUERIED = "channels.queried" as const;

/**
 * Normalize `?channel=` to the custom channel id used with `client.channel("messaging", id)`.
 * Accepts either a bare id or a full cid such as `messaging:abc-def`.
 */
function messagingCustomIdFromQueryParam(target: string): string {
  const t = target.trim();
  if (!t) return t;
  const colon = t.lastIndexOf(":");
  return colon === -1 ? t : t.slice(colon + 1);
}

function channelMatchesTarget(ch: Channel, target: string, messagingId: string): boolean {
  const cid = ch.cid ?? "";
  return (
    cid === target ||
    cid === `messaging:${messagingId}` ||
    ch.id === messagingId ||
    ch.id === target
  );
}

function pickActiveChannel(
  client: { activeChannels: Record<string, Channel> },
  target: string,
  messagingId: string,
): Channel | undefined {
  const map = client.activeChannels;
  const direct = map[target];
  if (direct && channelMatchesTarget(direct, target, messagingId)) return direct;
  for (const ch of Object.values(map)) {
    if (channelMatchesTarget(ch, target, messagingId)) return ch;
  }
  return undefined;
}

function pickMessagingIdFromQueried(event: Event, messagingId: string): string | undefined {
  const rows = event.queriedChannels?.channels;
  if (!rows?.length) return undefined;
  for (const row of rows) {
    const id = row.channel?.id;
    if (id && id === messagingId) return id;
  }
  return undefined;
}

/**
 * One-way URL sync for Stream’s active channel.
 *
 * **Deep link (`?channel=`):** On first paint the channel may not yet exist in `client.activeChannels`
 * because `ChannelList` has not finished its initial query. In that case we subscribe once to Stream’s
 * `channels.queried` event; when the list query completes we either pick the channel from `activeChannels`
 * or call `client.channel("messaging", id).watch()` once so the thread has state, then `setActiveChannel`.
 *
 * **URL updates:** When the active channel changes, we `replaceState` the `channel` query param to the
 * current `cid` (no history spam). We do not run bidirectional loops or store a parallel “selected” channel.
 */
export function useActiveConversation(params: UseActiveConversationParams) {
  const { channel, setActiveChannel, client } = useChatContext();
  const searchParams = useSearchParams();
  const router = useRouter();

  const clearActiveConversation = useCallback(() => setActiveChannel(undefined), [setActiveChannel]);

  useEffect(() => {
    const urlParam = (searchParams.get("channel") ?? "").trim();
    const target = (urlParam || params.initialChannelParam || "").trim();
    if (!target) return;

    const messagingId = messagingCustomIdFromQueryParam(target);
    if (!messagingId) return;

    if (channel && channelMatchesTarget(channel, target, messagingId)) {
      return;
    }

    let cancelled = false;

    const finish = (ch: Channel) => {
      if (cancelled) return;
      setActiveChannel(ch);
    };

    const tryPickCached = (): boolean => {
      const picked = pickActiveChannel(client, target, messagingId);
      if (picked) {
        finish(picked);
        return true;
      }
      return false;
    };

    if (tryPickCached()) return;

    const detach = () => {
      client.off(CHANNELS_QUERIED, onQueried);
    };

    const onQueried = async (event: Event) => {
      if (cancelled) return;

      if (tryPickCached()) {
        detach();
        return;
      }

      const idFromRows = pickMessagingIdFromQueried(event, messagingId);
      const idToWatch = idFromRows ?? messagingId;

      try {
        const ch = client.channel("messaging", idToWatch);
        await ch.watch();
        if (cancelled) return;
        finish(ch);
        detach();
      } catch {
        // Channel may still be syncing; keep listening for a later `channels.queried` batch.
      }
    };

    client.on(CHANNELS_QUERIED, onQueried);

    queueMicrotask(() => {
      if (cancelled) return;
      if (tryPickCached()) detach();
    });

    return () => {
      cancelled = true;
      detach();
    };
  }, [channel?.cid, client, params.initialChannelParam, searchParams, setActiveChannel]);

  useEffect(() => {
    const cid = channel?.cid ?? null;
    if (!cid) return;

    const current = searchParams.get("channel") ?? "";
    if (current === cid) return;

    const next = new URLSearchParams(searchParams.toString());
    next.set("channel", cid);
    router.replace(`?${next.toString()}`);
  }, [channel?.cid, router, searchParams]);

  return { clearActiveConversation };
}

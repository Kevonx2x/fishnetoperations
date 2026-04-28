import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Channel, Event } from "stream-chat";
import { useChatContext } from "stream-chat-react";

export type UseActiveConversationParams = {
  /**
   * Fallback when `?channel=` is not on the URL yet (e.g. first paint from props).
   * The URL string is still the source of truth once present.
   */
  initialChannelParam: string | null;
};

/** Stream client emits this after `ChannelList` (and similar) finish a channel query batch. */
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
 * **URL → Stream (deep link):** Apply `?channel=` (or `initialChannelParam`) when the active channel
 * does not already match. Depends on a **primitive** `channelQueryKey` string plus **`client.userID`**
 * — not the `searchParams` object, not `channel`, and not `channel.cid` — so the companion
 * `router.replace` effect cannot create a ping-pong. Listens to `channels.queried` only until the
 * channel is resolved, then unsubscribes.
 *
 * **Stream → URL:** When `channel.id` changes, `replace` the `channel` query param to that **id**
 * (same format as deep links from `/api/stream/channel`). Depends only on **`channel?.id`** — not
 * `searchParams` — so URL updates do not re-trigger the deep-link effect.
 */
export function useActiveConversation(params: UseActiveConversationParams) {
  const { channel, setActiveChannel, client } = useChatContext();
  const searchParams = useSearchParams();
  const router = useRouter();

  const channelQueryKey = useMemo(() => {
    const fromUrl = (searchParams.get("channel") ?? "").trim();
    const fromProp = (params.initialChannelParam ?? "").trim();
    return fromUrl || fromProp || "";
  }, [searchParams, params.initialChannelParam]);

  const channelRef = useRef(channel);
  channelRef.current = channel;

  const activeChannelIdRef = useRef<string | undefined>(undefined);
  activeChannelIdRef.current = channel?.id;

  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const clientRef = useRef(client);
  clientRef.current = client;

  const clearActiveConversation = useCallback(() => setActiveChannel(undefined), [setActiveChannel]);

  useEffect(() => {
    const cli = clientRef.current;
    if (!cli?.userID) return;

    const target = channelQueryKey;
    if (!target) return;

    const messagingId = messagingCustomIdFromQueryParam(target);
    if (!messagingId) return;

    const active = channelRef.current;
    if (active && channelMatchesTarget(active, target, messagingId)) {
      return;
    }

    let cancelled = false;

    const detach = () => {
      cli.off(CHANNELS_QUERIED, onQueried);
    };

    const finish = (ch: Channel) => {
      if (cancelled) return;
      if (activeChannelIdRef.current === ch.id) {
        detach();
        return;
      }
      setActiveChannel(ch);
      detach();
    };

    const tryPickCached = (): boolean => {
      const picked = pickActiveChannel(cli, target, messagingId);
      if (picked) {
        finish(picked);
        return true;
      }
      return false;
    };

    if (tryPickCached()) return;

    const onQueried = async (event: Event) => {
      if (cancelled) return;

      if (tryPickCached()) return;

      const idFromRows = pickMessagingIdFromQueried(event, messagingId);
      const idToWatch = idFromRows ?? messagingId;

      try {
        const ch = cli.channel("messaging", idToWatch);
        await ch.watch();
        if (cancelled) return;
        finish(ch);
      } catch {
        // Keep listening until a later batch or cleanup.
      }
    };

    cli.on(CHANNELS_QUERIED, onQueried);

    queueMicrotask(() => {
      if (cancelled) return;
      if (tryPickCached()) detach();
    });

    return () => {
      cancelled = true;
      detach();
    };
  }, [channelQueryKey, client?.userID, setActiveChannel]);

  useEffect(() => {
    const id = channel?.id ?? null;
    if (!id) return;

    const sp = searchParamsRef.current;
    const current = (sp.get("channel") ?? "").trim();
    if (current === id || messagingCustomIdFromQueryParam(current) === id) {
      return;
    }

    const next = new URLSearchParams(sp.toString());
    next.set("channel", id);
    router.replace(`?${next.toString()}`);
  }, [channel?.id, router]);

  return { clearActiveConversation };
}
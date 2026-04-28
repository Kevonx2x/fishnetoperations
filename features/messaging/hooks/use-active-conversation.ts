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
 * does not already match. Effect dependencies are **only fixed-length primitive strings** plus
 * `setActiveChannel` — never the Stream `client` object, never `searchParams`, never the `channel`
 * object or `channel.cid` — so the companion `router.replace` effect cannot create a ping-pong.
 * Listens to `channels.queried` only until the channel is resolved, then unsubscribes.
 *
 * **Stream → URL:** When the active channel’s **id string** changes, `replace` the `channel` query
 * param to that id (same format as deep links from `/api/stream/channel`). Dependencies are
 * **`activeChannelId` (string)** and **`router`** only — `searchParams` is read from a ref inside
 * the effect so it is not a dependency.
 */
export function useActiveConversation(params: UseActiveConversationParams) {
  const { channel, setActiveChannel, client } = useChatContext();
  const searchParams = useSearchParams();
  const router = useRouter();

  /** Stable primitive for `useEffect` deps — never pass the Stream `client` instance in the array. */
  const streamUserId: string = client?.userID ?? "";

  /** Stable primitive for `useEffect` deps — never pass the `channel` object in the array. */
  const activeChannelId: string = channel?.id ?? "";

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
    if (!streamUserId || !cli?.userID) return;

    const target = channelQueryKey;
    if (!target) return;

    const messagingId = messagingCustomIdFromQueryParam(target);
    if (!messagingId) return;

    const active = channelRef.current;
    if (active && channelMatchesTarget(active, target, messagingId)) {
      return;
    }

    let cancelled = false;

    /**
     * `detach` runs from `finish`, early `tryPickCached` exits, and effect cleanup — it must call
     * `cli.off` with the same function reference passed to `cli.on`. A `const onQueried` declared
     * below `detach` leaves `onQueried` in the temporal dead zone when `detach` is created, so we
     * hold the listener in a `let` initialized to `null`, assign the handler after `detach`/`finish`
     * exist, then register with Stream.
     */
    let onQueried: ((event: Event) => void | Promise<void>) | null = null;

    const detach = () => {
      if (onQueried) {
        cli.off(CHANNELS_QUERIED, onQueried);
        onQueried = null;
      }
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

    onQueried = async (event: Event) => {
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
  }, [channelQueryKey, setActiveChannel, streamUserId]);

  useEffect(() => {
    if (!activeChannelId) return;

    const sp = searchParamsRef.current;
    const current = (sp.get("channel") ?? "").trim();
    if (current === activeChannelId || messagingCustomIdFromQueryParam(current) === activeChannelId) {
      return;
    }

    const next = new URLSearchParams(sp.toString());
    next.set("channel", activeChannelId);
    router.replace(`?${next.toString()}`);
  }, [activeChannelId, router]);

  return { clearActiveConversation };
}
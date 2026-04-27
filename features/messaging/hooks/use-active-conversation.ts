import { useCallback, useEffect, useRef } from "react";
import type { ChannelFilters, ChannelSort } from "stream-chat";
import { useChatContext } from "stream-chat-react";

export type UseActiveConversationParams = {
  filters: ChannelFilters;
  sort: ChannelSort;
  /** Channel id (not cid) from deep link (?channel=...) */
  initialChannelId: string | null;
  /** When false, allow desktop to auto-select the first channel if none is active. */
  setActiveChannelOnMount: boolean;
  isDesktop: boolean;
};

/**
 * Single source of truth for setting/maintaining the active conversation.
 *
 * Guarantees:
 * - Deep link (?channel=ID) applies only once, then never “snaps back”.
 * - Optional desktop auto-select of first channel when none is active.
 */
export function useActiveConversation(params: UseActiveConversationParams) {
  const { channel, setActiveChannel, client } = useChatContext();
  const initialSelectionAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (params.setActiveChannelOnMount) return;
    if (!params.isDesktop || channel) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await client.queryChannels(params.filters, params.sort, {
          state: true,
          presence: true,
          limit: 30,
        });
        if (cancelled || !rows[0]) return;
        setActiveChannel(rows[0]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channel, client, params.filters, params.isDesktop, params.setActiveChannelOnMount, params.sort, setActiveChannel]);

  useEffect(() => {
    if (!params.isDesktop) return;
    const targetId = (params.initialChannelId ?? "").trim();
    if (!targetId) return;
    if (initialSelectionAppliedRef.current === targetId) return;
    if (channel?.id === targetId) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await client.queryChannels({ type: "messaging", id: targetId }, params.sort, {
          state: true,
          presence: true,
          limit: 1,
        });
        if (cancelled || !rows[0]) return;
        initialSelectionAppliedRef.current = targetId;
        setActiveChannel(rows[0]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channel?.id, client, params.initialChannelId, params.isDesktop, params.sort, setActiveChannel]);

  const clearActiveConversation = useCallback(() => setActiveChannel(undefined), [setActiveChannel]);

  return { activeChannel: channel, setActiveChannel, clearActiveConversation };
}


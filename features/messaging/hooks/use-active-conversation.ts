import { useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useChatContext } from "stream-chat-react";

export type UseActiveConversationParams = {
  /**
   * Optional deep link value (from UI integration). This module treats the URL as source-of-truth
   * on mount only; after that, Stream active channel is the truth and URL updates are one-way.
   */
  initialChannelParam: string | null;
};

/**
 * One-way URL sync helper for Stream active channel.
 *
 * Rules:
 * - On mount, if `?channel=` exists and `client.activeChannels` already contains it (by cid key or matching id),
 *   call `setActiveChannel` exactly once.
 * - On active channel change, update `?channel=` via `replace()` (no history pollution).
 * - No `queryChannels` lookups. No parallel "selected channel" state.
 */
export function useActiveConversation(params: UseActiveConversationParams) {
  const { channel, setActiveChannel, client } = useChatContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current) return;
    if (channel) {
      appliedRef.current = true;
      return;
    }

    const urlParam = (searchParams.get("channel") ?? "").trim();
    const target = (urlParam || params.initialChannelParam || "").trim();
    if (!target) return;

    const activeChannels = (client as unknown as { activeChannels?: Record<string, unknown> }).activeChannels as
      | Record<string, { cid?: string; id?: string } | undefined>
      | undefined;
    if (!activeChannels) return;

    const byCid = activeChannels[target];
    if (byCid && typeof byCid === "object") {
      appliedRef.current = true;
      setActiveChannel(byCid as unknown as Parameters<typeof setActiveChannel>[0]);
      return;
    }

    const byId = Object.values(activeChannels).find((ch) => ch?.id === target);
    if (byId) {
      appliedRef.current = true;
      setActiveChannel(byId as unknown as Parameters<typeof setActiveChannel>[0]);
    }
  }, [channel, client, params.initialChannelParam, searchParams, setActiveChannel]);

  useEffect(() => {
    const cid = channel?.cid ?? null;
    if (!cid) return;

    const current = searchParams.get("channel") ?? "";
    if (current === cid) return;

    const next = new URLSearchParams(searchParams.toString());
    next.set("channel", cid);
    router.replace(`?${next.toString()}`);
  }, [channel?.cid, router, searchParams]);

  const clearActiveConversation = useCallback(() => setActiveChannel(undefined), [setActiveChannel]);

  return { clearActiveConversation };
}


import { getStreamClient } from "@/lib/stream";

export type UnarchiveUserChannelsResult = {
  unarchived: number;
  channels: string[];
};

/**
 * Admin support tool: un-archives all Stream messaging channels for a given user.
 *
 * Why this exists:
 * - Stream archives are per-membership (`membership.archived_at`), not global to the channel.
 * - Stream React `ChannelList` hides archived channels by default, which can make a user appear to have “no channels”.
 */
export async function unarchiveUserChannels(params: { userId: string }): Promise<UnarchiveUserChannelsResult> {
  const userId = params.userId.trim();
  if (!userId) throw new Error("user_id is required");

  const stream = getStreamClient();

  // IMPORTANT: `archived: true` is membership-scoped and only applies when `user_id` is provided.
  const channels = await stream.queryChannels(
    { type: "messaging", members: { $in: [userId] }, archived: true },
    { last_message_at: -1 },
    { limit: 200, state: true, watch: false, presence: false, user_id: userId },
  );

  const updated: string[] = [];
  for (const ch of channels) {
    const type = (ch.type ?? "messaging").trim();
    const id = (ch.id ?? "").trim();
    if (!id) continue;

    // Prefer SDK helper if present; otherwise fall back to raw REST call.
    const channel = stream.channel(type, id);
    const hasSdkUnarchive =
      typeof (channel as unknown as { unarchive?: unknown }).unarchive === "function";

    if (hasSdkUnarchive) {
      await (channel as unknown as { unarchive: (userId: string) => Promise<unknown> }).unarchive(userId);
    } else {
      // Fallback: DELETE /channels/{type}/{id}/archive?user_id=...
      // stream-chat JS exposes low-level HTTP methods; use `delete` when available.
      const del = (stream as unknown as { delete?: unknown }).delete;
      if (typeof del !== "function") {
        throw new Error("Stream SDK does not support unarchive via SDK or raw delete()");
      }
      await (stream as unknown as { delete: (url: string, params?: Record<string, unknown>) => Promise<unknown> }).delete(
        `channels/${encodeURIComponent(type)}/${encodeURIComponent(id)}/archive`,
        { user_id: userId },
      );
    }

    updated.push(ch.cid);
  }

  return { unarchived: updated.length, channels: updated };
}


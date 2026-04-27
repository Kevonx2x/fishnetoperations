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
    try {
      // stream-chat@9.x signature: unarchive(opts?: { user_id?: string })
      await ch.unarchive({ user_id: userId });
      updated.push(ch.cid);
    } catch (err) {
      // Temporary forensic log (no plaintext user id).
      // Remove after confirming the endpoint works end-to-end.
      console.error("[unarchive-user-channels] Failed for", ch.cid, err);
      throw err;
    }
  }

  return { unarchived: updated.length, channels: updated };
}


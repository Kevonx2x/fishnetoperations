import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSessionProfile } from "@/lib/admin-api-auth";
import { getStreamClient } from "@/lib/stream";
import { supportAvatarUrlFromEnv, supportChannelIdForUser } from "@/lib/support-channel";

export const dynamic = "force-dynamic";

/**
 * Ensures a 1:1 messaging channel exists between the signed-in user and the support admin.
 * Idempotent: safe to call on every Messages page load.
 */
export async function POST(_req: NextRequest) {
  console.log("[support-channel] env check", {
    raw: process.env.NEXT_PUBLIC_SUPPORT_ADMIN_USER_ID,
    trimmed: process.env.NEXT_PUBLIC_SUPPORT_ADMIN_USER_ID?.trim(),
    email: process.env.SUPPORT_NOTIFICATION_EMAIL,
  });
  try {
    const session = await getSessionProfile();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminId = process.env.NEXT_PUBLIC_SUPPORT_ADMIN_USER_ID?.trim();
    if (!adminId) {
      return NextResponse.json(
        { error: "Server misconfiguration: NEXT_PUBLIC_SUPPORT_ADMIN_USER_ID is not set" },
        { status: 503 },
      );
    }

    const userId = session.userId;
    if (userId === adminId) {
      return NextResponse.json({ ok: true, skipped: true, reason: "admin" });
    }

    const stream = getStreamClient();
    const channelId = supportChannelIdForUser(userId);
    const avatarUrl = supportAvatarUrlFromEnv();

    await stream.upsertUser({
      id: adminId,
      name: "BahayGo Support",
      image: avatarUrl,
    });

    const filter = {
      type: "messaging" as const,
      id: channelId,
      members: { $in: [userId] },
    };
    const existing = await stream.queryChannels(filter, { last_message_at: -1 }, { limit: 1 });
    if (existing.length > 0) {
      return NextResponse.json({ ok: true, existed: true, channelId });
    }

    const channel = stream.channel("messaging", channelId, {
      members: [userId, adminId],
      created_by_id: userId,
      is_support: true,
      display_name: "BahayGo Support",
      display_avatar_url: avatarUrl,
    } as Record<string, unknown>);

    await channel.create();

    return NextResponse.json({ ok: true, created: true, channelId });
  } catch (e) {
    console.error("[ensure-support-channel]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getSessionProfile } from "@/lib/admin-api-auth";
import { getStreamClient } from "@/lib/stream";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { supportAvatarUrlFromEnv, supportChannelIdForUser } from "@/lib/support-channel";

export const dynamic = "force-dynamic";

async function supportWelcomeFirstName(userId: string): Promise<string> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) return "there";

    const sb = createSupabaseAdmin();
    const { data: profile } = await sb
      .from("profiles")
      .select("first_name, full_name")
      .eq("id", userId)
      .maybeSingle();

    const first = (profile?.first_name as string | null | undefined)?.trim();
    if (first) return first;

    const full = (profile?.full_name as string | null | undefined)?.trim();
    if (full) {
      const word = full.split(/\s+/)[0]?.trim();
      if (word) return word;
    }
  } catch (e) {
    console.error("[ensure-support-channel] profile fetch for welcome", e);
  }
  return "there";
}

/**
 * Ensures a 1:1 messaging channel exists between the signed-in user and the support admin.
 * Idempotent: safe to call on every Messages page load.
 */
export async function POST(_req: NextRequest) {
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

    try {
      const firstName = await supportWelcomeFirstName(userId);
      const welcomeText = `Hi ${firstName}! 👋 Welcome to BahayGo. I'm here to help with anything you need — questions about listings, agent verification, your account, or just getting started. What's on your mind?`;
      await channel.sendMessage({
        text: welcomeText,
        user: { id: adminId },
      });
    } catch (welcomeErr) {
      console.error("[ensure-support-channel] welcome message send failed", welcomeErr);
    }

    return NextResponse.json({ ok: true, created: true, channelId });
  } catch (e) {
    console.error("[ensure-support-channel]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}

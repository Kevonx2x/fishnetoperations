import { NextResponse, type NextRequest } from "next/server";

import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getStreamClient } from "@/lib/stream";

export async function getPeerAvatar(req: NextRequest) {
  try {
    const session = await getSessionProfile();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const peerId = req.nextUrl.searchParams.get("user_id")?.trim();
    if (!peerId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    if (peerId === session.userId) return NextResponse.json({ error: "Invalid peer" }, { status: 400 });

    const stream = getStreamClient();
    const channels = await stream.queryChannels(
      { type: "messaging", members: { $in: [session.userId] } },
      { last_message_at: -1 },
      { state: true, limit: 100 },
    );
    const shared = channels.some((ch) => Boolean(ch.state?.members?.[peerId]));
    if (!shared) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = createSupabaseAdmin();
    const { data: profile, error } = await admin.from("profiles").select("avatar_url").eq("id", peerId).maybeSingle();
    if (error) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });

    const url = (profile?.avatar_url as string | undefined)?.trim() || null;
    return NextResponse.json({ avatar_url: url });
  } catch (e) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}


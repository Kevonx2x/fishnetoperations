import { NextResponse } from "next/server";

import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getStreamClient } from "@/lib/stream";

export async function postStreamToken(req: Request) {
  try {
    const session = await getSessionProfile();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { user_id?: string };
    try {
      body = (await req.json()) as { user_id?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const userId = body.user_id?.trim();
    if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    if (userId !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = createSupabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile?.id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    let image = (profile.avatar_url as string | null | undefined)?.trim() || undefined;
    if (!image && (profile as { role?: string | null }).role === "agent") {
      const { data: agentRow } = await admin
        .from("agents")
        .select("image_url")
        .eq("user_id", userId)
        .maybeSingle();
      image = (agentRow?.image_url as string | null | undefined)?.trim() || undefined;
    }

    const stream = getStreamClient();
    await stream.upsertUser({
      id: userId,
      name: (profile.full_name as string | null)?.trim() || session.email || "User",
      image,
    });

    const token = stream.createToken(userId);
    return NextResponse.json({ token });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
  }
}


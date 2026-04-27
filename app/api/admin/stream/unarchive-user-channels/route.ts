import { NextResponse } from "next/server";

import { requireFullAdminSession } from "@/lib/admin-api-auth";
import { unarchiveUserChannels } from "@/features/messaging/api/unarchive-user-channels/handler";

export async function POST(req: Request) {
  const denied = await requireFullAdminSession();
  if (denied === "unauthorized") {
    return NextResponse.json({ error: "Admin sign-in required" }, { status: 401 });
  }

  let body: { user_id?: string };
  try {
    body = (await req.json()) as { user_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = body.user_id?.trim();
  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  try {
    const res = await unarchiveUserChannels({ userId });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unarchive failed" },
      { status: 500 },
    );
  }
}


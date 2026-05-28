import { NextResponse } from "next/server";

import { postStreamToken } from "@/features/messaging/api/token/handler";

/** Avoid 404 noise from accidental GET/prefetch — clients must POST. */
export async function GET() {
  return NextResponse.json({ error: "Use POST with { user_id }" }, { status: 200 });
}

export async function POST(req: Request) {
  return postStreamToken(req);
}

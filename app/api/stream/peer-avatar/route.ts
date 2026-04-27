import type { NextRequest } from "next/server";
import { getPeerAvatar } from "@/features/messaging/api/peer-avatar/handler";

/**
 * Returns a peer's avatar_url when the caller shares a Stream messaging channel with them.
 * Used from chat UI when Stream `image` is empty and client-side profiles RLS blocks a direct read.
 */
export async function GET(req: NextRequest) {
  return getPeerAvatar(req);
}

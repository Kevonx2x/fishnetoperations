import { fail, ok } from "@/lib/api/response";
import { requireFullAdminSession } from "@/lib/admin-api-auth";
import { backfillChannelMetadata } from "@/features/messaging/api/backfill-metadata/handler";

/** Admin-only endpoint: patches missing property metadata onto existing Stream channels. */
export async function POST() {
  const denied = await requireFullAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const summary = await backfillChannelMetadata();
  return ok(summary);
}


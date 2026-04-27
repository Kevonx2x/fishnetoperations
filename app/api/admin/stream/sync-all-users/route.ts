import { fail, ok } from "@/lib/api/response";
import { requireFullAdminSession } from "@/lib/admin-api-auth";
import { syncAllUsersToStream } from "@/features/messaging/api/admin-sync-all-users/handler";

export async function POST() {
  const denied = await requireFullAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const res = await syncAllUsersToStream();
  if (!res.ok) return fail("DATABASE_ERROR", res.error, 500);
  return ok(res.data);
}


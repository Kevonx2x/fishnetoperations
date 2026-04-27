import { fail, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { syncOneUserToStream } from "@/features/messaging/api/admin-sync-user/handler";

export async function POST(req: Request) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  let body: { user_id?: string };
  try {
    body = (await req.json()) as { user_id?: string };
  } catch {
    return fail("INVALID_JSON", "Invalid JSON", 400);
  }

  const userId = body.user_id?.trim();
  if (!userId) {
    return fail("MISSING_FIELD", "user_id is required", 400, undefined, "user_id");
  }

  const res = await syncOneUserToStream(userId);
  if (!res.ok) {
    if (res.error.code === "NOT_FOUND") return fail("NOT_FOUND", res.error.message, 404);
    return fail(res.error.code, res.error.message, 500);
  }
  return ok(res.data);
}


import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(_request: NextRequest) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) {
      return fail("UNAUTHORIZED", "Sign in required", 401);
    }

    const uid = session.userId;
    const admin = createSupabaseAdmin();

    await admin.from("agents").delete().eq("user_id", uid);
    await admin.from("brokers").delete().eq("user_id", uid);

    const { error: authErr } = await admin.auth.admin.deleteUser(uid);
    if (authErr) {
      return fail("AUTH_ERROR", authErr.message, 500);
    }

    return ok({ deleted: true });
  } catch (e) {
    console.error("[delete-account]", e);
    return fail("SERVER_ERROR", "Unexpected error", 500);
  }
}

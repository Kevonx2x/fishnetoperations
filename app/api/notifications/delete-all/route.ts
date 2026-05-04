import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(_request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }

    let admin: ReturnType<typeof createSupabaseAdmin>;
    try {
      admin = createSupabaseAdmin();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Server configuration error";
      return Response.json({ error: msg }, { status: 500 });
    }

    const { data, error: delErr } = await admin
      .from("notifications")
      .delete()
      .eq("user_id", session.userId)
      .select("id");

    if (delErr) {
      return Response.json({ error: delErr.message }, { status: 500 });
    }

    return Response.json({ ok: true as const, deletedCount: data?.length ?? 0 });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}

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

    const { count, error: countErr } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId);

    if (countErr) {
      return Response.json({ error: countErr.message }, { status: 500 });
    }

    const deletedCount = count ?? 0;

    const { error: delErr } = await admin.from("notifications").delete().eq("user_id", session.userId);

    if (delErr) {
      return Response.json({ error: delErr.message }, { status: 500 });
    }

    return Response.json({ ok: true as const, deletedCount });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}

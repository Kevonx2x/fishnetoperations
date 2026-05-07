import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "broker") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const sb = await createSupabaseServerClient();

  const { error: leadErr } = await sb.from("leads").delete().eq("is_demo", true).eq("agent_id", session.userId);

  if (leadErr) {
    return Response.json({ error: leadErr.message }, { status: 500 });
  }

  const { error: propErr } = await sb
    .from("properties")
    .delete()
    .eq("is_demo", true)
    .eq("listed_by", session.userId);

  if (propErr) {
    return Response.json({ error: propErr.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

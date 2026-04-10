import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Creates one notification per listing expiring within 7 days (not yet expired),
 * only if expiry_notified_at is null. Sets expiry_notified_at after send.
 */
export async function POST() {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "broker" && session.role !== "admin") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const now = new Date();
  const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const uid = session.userId;

  const { data: rows, error: qErr } = await admin
    .from("properties")
    .select("id, name, location, expires_at")
    .eq("listed_by", uid)
    .not("expires_at", "is", null)
    .gt("expires_at", now.toISOString())
    .lte("expires_at", week.toISOString())
    .is("expiry_notified_at", null);

  if (qErr) {
    return Response.json({ error: qErr.message }, { status: 500 });
  }

  let sent = 0;
  for (const row of rows ?? []) {
    const r = row as { id: string; name: string | null; location: string | null; expires_at: string };
    const exp = new Date(r.expires_at).getTime();
    const days = Math.max(1, Math.ceil((exp - now.getTime()) / (24 * 60 * 60 * 1000)));
    const label = (r.name ?? r.location ?? "A listing").trim() || "A listing";

    const { error: insErr } = await admin.from("notifications").insert({
      user_id: uid,
      type: "listing_expiry",
      title: "Your listing is expiring soon",
      body: `${label} expires in ${days} days. Renew it to keep it visible.`,
      metadata: { property_id: r.id, link: "/dashboard/agent?tab=listings" },
    });

    if (insErr) continue;

    const { error: upErr } = await admin
      .from("properties")
      .update({ expiry_notified_at: now.toISOString() })
      .eq("id", r.id);

    if (!upErr) sent += 1;
  }

  return Response.json({ success: true, sent });
}

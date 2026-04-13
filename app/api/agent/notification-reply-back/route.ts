import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { propertyAddressLabel } from "@/lib/property-address-label";

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "broker" && session.role !== "admin") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  let body: { reply_to_notification_id?: unknown; message?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const replyToId =
    typeof body.reply_to_notification_id === "string" ? body.reply_to_notification_id.trim() : "";
  if (!replyToId) {
    return Response.json({ error: "reply_to_notification_id required" }, { status: 400 });
  }

  const msg = typeof body.message === "string" ? body.message.trim() : "";
  if (!msg) {
    return Response.json({ error: "message required" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const em = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: em }, { status: 500 });
  }

  const { data: child, error: childErr } = await admin
    .from("notifications")
    .select("id, user_id, parent_id, property_name, metadata")
    .eq("id", replyToId)
    .maybeSingle();
  if (childErr) return Response.json({ error: childErr.message }, { status: 500 });
  if (!child) return Response.json({ error: "Notification not found" }, { status: 404 });

  const c = child as {
    id: string;
    user_id: string;
    parent_id: string | null;
    property_name: string | null;
    metadata: Record<string, unknown> | null;
  };

  if (c.user_id !== session.userId && session.role !== "admin") {
    return Response.json({ error: "Not your notification" }, { status: 403 });
  }

  const parentId = c.parent_id?.trim() || "";
  if (!parentId) {
    return Response.json({ error: "parent_id missing on client reply" }, { status: 400 });
  }

  const { data: parent, error: parentErr } = await admin
    .from("notifications")
    .select("id, user_id, metadata")
    .eq("id", parentId)
    .maybeSingle();
  if (parentErr) return Response.json({ error: parentErr.message }, { status: 500 });
  if (!parent) return Response.json({ error: "Parent notification not found" }, { status: 404 });

  const p = parent as { id: string; user_id: string; metadata: Record<string, unknown> | null };
  const clientId = p.user_id;

  const meta = p.metadata ?? {};
  const propertyId = typeof meta.property_id === "string" ? meta.property_id : "";

  const { data: prop } = propertyId
    ? await admin.from("properties").select("name, location").eq("id", propertyId).maybeSingle()
    : { data: null as unknown };

  const propertyName =
    (c.property_name ?? "").trim() ||
    (typeof meta.property_name === "string" ? meta.property_name.trim() : "") ||
    propertyAddressLabel(prop as { name?: string | null; location?: string | null } | null) ||
    "Property";

  const { data: agentRow } = await admin
    .from("agents")
    .select("name")
    .eq("user_id", session.userId)
    .maybeSingle();

  const agentName = (agentRow as { name?: string | null } | null)?.name?.trim() || session.email || "Your agent";

  const title = `Message from ${agentName} about ${propertyName}`;

  const { data: ins, error: insErr } = await admin
    .from("notifications")
    .insert({
      user_id: clientId,
      type: "agent_message",
      parent_id: p.id,
      title,
      body: msg,
      property_name: propertyName,
      metadata: {
        property_id: propertyId || null,
        property_name: propertyName,
        from_agent_user_id: session.userId,
      },
    })
    .select("id")
    .maybeSingle();

  if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

  return Response.json({ success: true, id: (ins as { id?: string } | null)?.id ?? null });
}


import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { propertyAddressLabel } from "@/lib/property-address-label";
import { normalizePhoneE164, sendSmsTo } from "@/lib/twilio-sms";

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: { notification_id?: unknown; reply_message?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const notificationId = typeof body.notification_id === "string" ? body.notification_id.trim() : "";
  if (!notificationId) {
    return Response.json({ error: "notification_id required" }, { status: 400 });
  }

  const replyMessage = typeof body.reply_message === "string" ? body.reply_message.trim() : "";
  if (!replyMessage) {
    return Response.json({ error: "reply_message required" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const { data: orig, error: origErr } = await admin
    .from("notifications")
    .select("id, user_id, type, title, body, metadata, created_at")
    .eq("id", notificationId)
    .maybeSingle();

  if (origErr) {
    return Response.json({ error: origErr.message }, { status: 500 });
  }
  if (!orig) {
    return Response.json({ error: "Notification not found" }, { status: 404 });
  }

  const o = orig as {
    id: string;
    user_id: string;
    type: string;
    metadata: Record<string, unknown> | null;
  };

  if (o.user_id !== session.userId) {
    return Response.json({ error: "Not your notification" }, { status: 403 });
  }

  const meta = o.metadata ?? {};
  const fromAgentUserId =
    typeof meta.from_agent_user_id === "string"
      ? meta.from_agent_user_id
      : typeof meta.agent_user_id === "string"
        ? meta.agent_user_id
        : "";
  if (!fromAgentUserId) {
    return Response.json({ error: "Missing agent target for reply" }, { status: 400 });
  }

  const propertyId = typeof meta.property_id === "string" ? meta.property_id : "";

  const { data: prop } = propertyId
    ? await admin.from("properties").select("name, location").eq("id", propertyId).maybeSingle()
    : { data: null as unknown };

  const propertyName =
    (typeof meta.property_name === "string" ? meta.property_name.trim() : "") ||
    propertyAddressLabel(prop as { name?: string | null; location?: string | null } | null) ||
    "Property";

  const { data: clientProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", session.userId)
    .maybeSingle();

  const clientName =
    (clientProfile as { full_name?: string | null } | null)?.full_name?.trim() ||
    session.email ||
    "Client";

  const { data: ins, error: insErr } = await admin
    .from("notifications")
    .insert({
      user_id: fromAgentUserId,
      type: "client_reply",
      parent_id: o.id,
      title: "Client Reply",
      body: `${clientName}: ${replyMessage}`,
      property_name: propertyName,
      reply_message: replyMessage,
      metadata: {
        property_id: propertyId || null,
        property_name: propertyName,
        client_user_id: session.userId,
        client_name: clientName,
      },
    })
    .select("id")
    .maybeSingle();

  if (insErr) {
    return Response.json({ error: insErr.message }, { status: 500 });
  }

  const { data: agentRow } = await admin
    .from("agents")
    .select("phone, name")
    .eq("user_id", fromAgentUserId)
    .maybeSingle();

  const agentPhone = normalizePhoneE164((agentRow as { phone?: string | null } | null)?.phone);
  if (agentPhone) {
    const smsBody = `Client reply from ${clientName}\nProperty: ${propertyName}\nMessage: ${replyMessage}`;
    await sendSmsTo(agentPhone, smsBody);
  }

  return Response.json({ success: true, id: (ins as { id?: string } | null)?.id ?? null });
}


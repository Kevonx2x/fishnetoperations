import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isClientDocumentType, labelForClientDocType } from "@/lib/client-documents";

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "broker" && session.role !== "admin") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  let body: { lead_id?: unknown; document_types?: unknown };
  try {
    body = (await req.json()) as { lead_id?: unknown; document_types?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const leadId =
    typeof body.lead_id === "number"
      ? body.lead_id
      : typeof body.lead_id === "string"
        ? parseInt(body.lead_id, 10)
        : NaN;
  if (!Number.isFinite(leadId)) {
    return Response.json({ error: "lead_id required" }, { status: 400 });
  }

  const rawTypes = body.document_types;
  if (!Array.isArray(rawTypes) || rawTypes.length === 0) {
    return Response.json({ error: "document_types required" }, { status: 400 });
  }

  const documentTypes = rawTypes
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t): t is string => Boolean(t && isClientDocumentType(t)));

  if (documentTypes.length === 0) {
    return Response.json({ error: "No valid document types" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, agent_id, broker_id, client_id")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) {
    return Response.json({ error: leadErr.message }, { status: 500 });
  }
  if (!lead) {
    return Response.json({ error: "Lead not found" }, { status: 404 });
  }

  const agentId = (lead as { agent_id: string | null }).agent_id;
  const brokerId = (lead as { broker_id: string | null }).broker_id;
  const clientId = (lead as { client_id: string | null }).client_id;
  const uid = session.userId;

  const allowed =
    session.role === "admin" || agentId === uid || brokerId === uid;
  if (!allowed) {
    return Response.json({ error: "Not your lead" }, { status: 403 });
  }

  if (!clientId) {
    return Response.json(
      { error: "This lead is not linked to a client account yet." },
      { status: 400 },
    );
  }

  const targetAgentUserId = agentId || uid;

  const { data: agentRow } = await admin
    .from("agents")
    .select("name")
    .eq("user_id", targetAgentUserId)
    .maybeSingle();

  const { data: profRow } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", targetAgentUserId)
    .maybeSingle();

  const agentName =
    (agentRow as { name?: string | null } | null)?.name?.trim() ||
    (profRow as { full_name?: string | null } | null)?.full_name?.trim() ||
    session.email ||
    "Your agent";

  const labels = documentTypes.map((t) => labelForClientDocType(t)).join(", ");
  const typesParam = encodeURIComponent(documentTypes.join(","));
  const nameParam = encodeURIComponent(agentName);
  const link = `/clients/${clientId}?reqAgent=${encodeURIComponent(targetAgentUserId)}&reqTypes=${typesParam}&reqAgentName=${nameParam}`;

  const title = `Document request from ${agentName}`;
  const bodyText = `Your agent has requested: ${labels}. Open your profile → Documents to share them.`;

  const { error: insErr } = await admin.from("notifications").insert({
    user_id: clientId,
    type: "document_request",
    title,
    body: bodyText,
    metadata: {
      link,
      lead_id: leadId,
      agent_user_id: targetAgentUserId,
      document_types: documentTypes,
    },
  });

  if (insErr) {
    return Response.json({ error: insErr.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

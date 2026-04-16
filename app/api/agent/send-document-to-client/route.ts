import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { leadAccessibleBySession, resolveTeamMemberSupervisorUserId } from "@/lib/team-member-lead-access";

const SIGNED_URL_SEC = 3600; /* 60 minutes */

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (
    session.role !== "agent" &&
    session.role !== "broker" &&
    session.role !== "admin" &&
    session.role !== "team_member"
  ) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const sbAuth = await createSupabaseServerClient();
  const supervisorUserId =
    session.role === "team_member" ? await resolveTeamMemberSupervisorUserId(sbAuth, session.userId) : null;
  if (session.role === "team_member" && !supervisorUserId) {
    return Response.json({ error: "Not a team member" }, { status: 403 });
  }

  let body: { deal_document_id?: unknown; lead_id?: unknown };
  try {
    body = (await req.json()) as { deal_document_id?: unknown; lead_id?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dealDocumentId =
    typeof body.deal_document_id === "string"
      ? body.deal_document_id.trim()
      : typeof body.deal_document_id === "number"
        ? String(body.deal_document_id)
        : "";
  if (!dealDocumentId) {
    return Response.json({ error: "deal_document_id required" }, { status: 400 });
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

  const allowed = leadAccessibleBySession(session, agentId, brokerId, supervisorUserId);
  if (!allowed) {
    return Response.json({ error: "Not your lead" }, { status: 403 });
  }

  if (!clientId) {
    return Response.json({ error: "This lead has no linked client." }, { status: 400 });
  }

  const { data: doc, error: docErr } = await admin
    .from("deal_documents")
    .select("id, lead_id, document_type, file_url, file_name, status, sent_to_client")
    .eq("id", dealDocumentId)
    .eq("lead_id", leadId)
    .maybeSingle();

  if (docErr) {
    return Response.json({ error: docErr.message }, { status: 500 });
  }
  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const row = doc as {
    document_type: string;
    file_url: string;
    file_name: string | null;
    status: string;
    sent_to_client?: boolean | null;
  };

  if (row.status !== "uploaded" && row.status !== "approved") {
    return Response.json({ error: "Document must be uploaded or approved first" }, { status: 400 });
  }

  if (row.sent_to_client === true) {
    return Response.json({ success: true, alreadySent: true });
  }

  const path = row.file_url?.trim();
  if (!path) {
    return Response.json({ error: "Document has no file path" }, { status: 400 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("deals")
    .createSignedUrl(path, SIGNED_URL_SEC);

  if (signErr || !signed?.signedUrl) {
    return Response.json(
      { error: signErr?.message ?? "Could not create signed URL" },
      { status: 500 },
    );
  }

  const signedUrl = signed.signedUrl;

  let agentDisplayName = "Your agent";
  if (agentId) {
    const { data: agentRow } = await admin
      .from("agents")
      .select("name")
      .eq("user_id", agentId)
      .maybeSingle();
    const n = (agentRow as { name?: string | null } | null)?.name?.trim();
    if (n) agentDisplayName = n;
  }

  const { error: nErr } = await admin.from("notifications").insert({
    user_id: clientId,
    type: "document_shared",
    title: "Your agent sent you a document",
    body: "A document has been shared with you for your property inquiry. Tap to view.",
    metadata: {
      signed_url: signedUrl,
      document_type: row.document_type,
      file_name: row.file_name ?? null,
      lead_id: leadId,
      deal_document_id: dealDocumentId,
      agent_name: agentDisplayName,
    },
  });

  if (nErr) {
    return Response.json({ error: nErr.message }, { status: 500 });
  }

  const { error: upErr } = await admin
    .from("deal_documents")
    .update({
      sent_to_client: true,
      sent_at: new Date().toISOString(),
    })
    .eq("id", dealDocumentId)
    .eq("lead_id", leadId);

  if (upErr) {
    return Response.json({ error: upErr.message }, { status: 500 });
  }

  await admin.from("activity_log").insert({
    actor_id: agentId ?? uid,
    action: "agent_document_sent_to_client",
    entity_type: "deal_document",
    entity_id: dealDocumentId,
    metadata: {
      client_user_id: clientId,
      agent_name: agentDisplayName,
      file_name: row.file_name ?? null,
      lead_id: leadId,
      document_type: row.document_type,
    },
  });

  return Response.json({ success: true });
}

import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { leadAccessibleBySession, resolveTeamMemberSupervisorUserId } from "@/lib/team-member-lead-access";
import { isClientDocumentType, type ClientDocumentTypeKey } from "@/lib/client-documents";

const STAGE_IDS = ["lead", "viewing", "offer", "reservation", "closed"] as const;
type PipelineStageId = (typeof STAGE_IDS)[number];

const DOC_META: Record<
  string,
  { label: string; suggested_for_stage: PipelineStageId }
> = {
  valid_id: { label: "Valid ID", suggested_for_stage: "viewing" },
  proof_of_income: { label: "Proof of Income", suggested_for_stage: "offer" },
  tin: { label: "TIN", suggested_for_stage: "offer" },
  contract_to_sell: { label: "Contract to Sell", suggested_for_stage: "reservation" },
  reservation_agreement: { label: "Reservation Agreement", suggested_for_stage: "reservation" },
  deed_of_sale: { label: "Deed of Sale", suggested_for_stage: "closed" },
  final_docs: { label: "Final Docs", suggested_for_stage: "closed" },
};

function isPipelineStage(s: string): s is PipelineStageId {
  return (STAGE_IDS as readonly string[]).includes(s);
}

function mapRequestSlugToClientType(slug: string): ClientDocumentTypeKey {
  if (slug === "valid_id") return "valid_id";
  if (slug === "proof_of_income") return "proof_of_funds";
  return "other";
}

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

  let body: {
    lead_id?: unknown;
    agent_id?: unknown;
    mode?: unknown;
    document_type?: unknown;
    document_name?: unknown;
    file_url?: unknown;
    required?: unknown;
    suggested_for_stage?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
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

  const mode = body.mode === "request" || body.mode === "send" ? body.mode : null;
  if (!mode) {
    return Response.json({ error: "mode must be request or send" }, { status: 400 });
  }

  const documentType = typeof body.document_type === "string" ? body.document_type.trim() : "";
  if (!documentType || !DOC_META[documentType]) {
    return Response.json({ error: "Invalid document_type" }, { status: 400 });
  }

  const meta = DOC_META[documentType];
  const required = body.required === true;

  const suggested =
    typeof body.suggested_for_stage === "string" && isPipelineStage(body.suggested_for_stage.trim())
      ? (body.suggested_for_stage.trim() as PipelineStageId)
      : null;
  if (!suggested) {
    return Response.json({ error: "suggested_for_stage required" }, { status: 400 });
  }
  if (suggested !== meta.suggested_for_stage) {
    return Response.json({ error: "suggested_for_stage does not match document type" }, { status: 400 });
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
    return Response.json(
      { error: "This lead is not linked to a client account yet." },
      { status: 400 },
    );
  }

  const requestedAgentId = typeof body.agent_id === "string" ? body.agent_id.trim() : "";
  const targetAgentUserId = agentId || uid;

  let agentRowId: string;
  if (session.role === "team_member" && supervisorUserId) {
    const { data: supAgent, error: supErr } = await admin
      .from("agents")
      .select("id")
      .eq("user_id", supervisorUserId)
      .maybeSingle();
    if (supErr) {
      return Response.json({ error: supErr.message }, { status: 500 });
    }
    const sid = (supAgent as { id?: string } | null)?.id;
    if (!sid) {
      return Response.json({ error: "Agent record not found for supervising agent" }, { status: 400 });
    }
    agentRowId = sid;
  } else {
    const sessionEmail = session.email?.trim() ?? "";
    if (!sessionEmail) {
      return Response.json({ error: "Missing agent email in session" }, { status: 400 });
    }
    const { data: agentByEmail, error: agentLookupErr } = await admin
      .from("agents")
      .select("id")
      .eq("email", sessionEmail)
      .maybeSingle();
    if (agentLookupErr) {
      return Response.json({ error: agentLookupErr.message }, { status: 500 });
    }
    const aid = (agentByEmail as { id?: string } | null)?.id;
    if (!aid) {
      return Response.json({ error: "Agent record not found for current user" }, { status: 400 });
    }
    agentRowId = aid;
  }
  const dealAgentId = requestedAgentId || agentRowId;

  const documentName =
    typeof body.document_name === "string" && body.document_name.trim()
      ? body.document_name.trim()
      : meta.label;

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

  if (mode === "request") {
    const { data: inserted, error: insErr } = await admin
      .from("deal_documents")
      .insert({
        lead_id: leadId,
        document_type: documentType,
        document_name: documentName,
        direction: "requested",
        agent_id: dealAgentId,
        status: "pending",
        file_url: null,
        required,
        suggested_for_stage: suggested,
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      if (insErr.code === "23505") {
        return Response.json(
          { error: "This document is already on file for this deal." },
          { status: 409 },
        );
      }
      return Response.json({ error: insErr.message }, { status: 500 });
    }

    const dealDocumentId = (inserted as { id: string } | null)?.id;
    const clientType = mapRequestSlugToClientType(documentType);
    const link = `/dashboard/client/pipeline?lead=${encodeURIComponent(String(leadId))}`;

    const { error: nErr } = await admin.from("notifications").insert({
      user_id: clientId,
      type: "document_request",
      title: `Upload requested: ${documentName}`,
      body: `Your agent asked you to upload “${documentName}” for this deal. Open Pipeline to add it.`,
      metadata: {
        link,
        lead_id: leadId,
        agent_user_id: targetAgentUserId,
        document_types: isClientDocumentType(clientType) ? [clientType] : [],
        deal_document_id: dealDocumentId,
        requested_label: documentName,
      },
    });

    if (nErr) {
      return Response.json({ error: nErr.message }, { status: 500 });
    }

    return Response.json({ success: true, id: dealDocumentId });
  }

  const fileUrl = typeof body.file_url === "string" ? body.file_url.trim() : "";
  if (!fileUrl) {
    return Response.json({ error: "file_url required for send" }, { status: 400 });
  }

  const sentAt = new Date().toISOString();

  const { data: inserted, error: insErr } = await admin
    .from("deal_documents")
    .insert({
      lead_id: leadId,
      document_type: documentType,
      document_name: documentName,
      direction: "sent",
      agent_id: dealAgentId,
      status: "uploaded",
      file_url: fileUrl,
      required,
      suggested_for_stage: suggested,
      sent_to_client: true,
      sent_at: sentAt,
    })
    .select("id")
    .maybeSingle();

  if (insErr) {
    if (insErr.code === "23505") {
      return Response.json(
        { error: "This document type already exists for this deal." },
        { status: 409 },
      );
    }
    return Response.json({ error: insErr.message }, { status: 500 });
  }

  const dealDocumentId = (inserted as { id: string } | null)?.id;
  const link = `/dashboard/client/pipeline?lead=${encodeURIComponent(String(leadId))}`;

  const { error: nErr } = await admin.from("notifications").insert({
    user_id: clientId,
    type: "document_shared",
    title: `New document from ${agentName}`,
    body: `Your agent sent you “${documentName}” to review for this deal. Open Pipeline to view it.`,
    metadata: {
      link,
      lead_id: leadId,
      deal_document_id: dealDocumentId,
      document_name: documentName,
      file_url: fileUrl,
      pending: false,
      agent_name: agentName,
    },
  });

  if (nErr) {
    return Response.json({ error: nErr.message }, { status: 500 });
  }

  return Response.json({ success: true, id: dealDocumentId });
}

import { randomUUID } from "crypto";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { leadAccessibleBySession, resolveTeamMemberSupervisorUserId } from "@/lib/team-member-lead-access";
import { isClientDocumentType, labelForClientDocType } from "@/lib/client-documents";

type DocItem = { type: string; document_name?: string | null };

function normalizeDocItems(body: {
  document_items?: unknown;
  document_types?: unknown;
}): { ok: true; items: DocItem[] } | { ok: false; message: string; status: number } {
  const rawItems = body.document_items;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const items: DocItem[] = [];
    for (const row of rawItems) {
      if (!row || typeof row !== "object") continue;
      const type = typeof (row as { type?: unknown }).type === "string" ? (row as { type: string }).type.trim() : "";
      if (!type || !isClientDocumentType(type)) {
        return { ok: false, message: "Invalid document item type", status: 400 };
      }
      const document_name =
        typeof (row as { document_name?: unknown }).document_name === "string"
          ? (row as { document_name: string }).document_name.trim()
          : "";
      if (type === "other") {
        if (!document_name) {
          return { ok: false, message: "document_name is required when type is other", status: 400 };
        }
        items.push({ type: "other", document_name });
      } else {
        items.push({ type });
      }
    }
    if (items.length === 0) {
      return { ok: false, message: "No valid document items", status: 400 };
    }
    return { ok: true, items };
  }

  const rawTypes = body.document_types;
  if (!Array.isArray(rawTypes) || rawTypes.length === 0) {
    return { ok: false, message: "document_types or document_items required", status: 400 };
  }
  const types = rawTypes
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t): t is string => Boolean(t && isClientDocumentType(t)));
  if (types.length === 0) {
    return { ok: false, message: "No valid document types", status: 400 };
  }
  if (types.includes("other")) {
    return {
      ok: false,
      message: "Use document_items with document_name when requesting type other",
      status: 400,
    };
  }
  return { ok: true, items: types.map((type) => ({ type })) };
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

  let body: { lead_id?: unknown; document_types?: unknown; document_items?: unknown };
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

  const parsedItems = normalizeDocItems(body);
  if (!parsedItems.ok) {
    return Response.json({ error: parsedItems.message }, { status: parsedItems.status });
  }
  const docItems = parsedItems.items;

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

  const targetAgentUserId = agentId || uid;

  const { data: agentRow } = await admin
    .from("agents")
    .select("name, id")
    .eq("user_id", targetAgentUserId)
    .maybeSingle();

  const agentRowUuid = (agentRow as { id?: string } | null)?.id ?? null;
  if (!agentRowUuid) {
    return Response.json({ error: "Agent record not found for this lead" }, { status: 400 });
  }

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

  const insertedIds: string[] = [];
  const displayLabels: string[] = [];

  for (const item of docItems) {
    const isOther = item.type === "other";
    const documentType = isOther ? `other:${randomUUID()}` : item.type;
    const documentName = isOther
      ? (item.document_name as string).trim()
      : labelForClientDocType(item.type);

    const { data: inserted, error: rowInsErr } = await admin
      .from("deal_documents")
      .insert({
        lead_id: leadId,
        document_type: documentType,
        document_name: documentName,
        direction: "requested",
        agent_id: agentRowUuid,
        status: "pending",
        file_url: null,
        required: true,
        suggested_for_stage: "viewing",
      })
      .select("id")
      .maybeSingle();

    if (rowInsErr) {
      if (rowInsErr.code === "23505") {
        return Response.json(
          { error: `A request for “${documentName}” already exists for this deal.` },
          { status: 409 },
        );
      }
      return Response.json({ error: rowInsErr.message }, { status: 500 });
    }
    const id = (inserted as { id?: string } | null)?.id;
    if (id) insertedIds.push(id);
    displayLabels.push(documentName);
  }

  const labels = displayLabels.join(", ");
  const pipelineLink = `/dashboard/client/pipeline?lead=${encodeURIComponent(String(leadId))}`;

  const { error: insErr } = await admin.from("notifications").insert({
    user_id: clientId,
    type: "document_request",
    title: `Document request from ${agentName}`,
    body: `Your agent has requested: ${labels}. Open Pipeline to upload and track progress.`,
    metadata: {
      link: pipelineLink,
      lead_id: leadId,
      agent_user_id: targetAgentUserId,
      document_types: docItems.map((i) => i.type),
      deal_document_ids: insertedIds,
    },
  });

  if (insErr) {
    return Response.json({ error: insErr.message }, { status: 500 });
  }

  return Response.json({ success: true, deal_document_ids: insertedIds });
}

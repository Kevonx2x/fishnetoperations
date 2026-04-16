import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { leadAccessibleBySession, resolveTeamMemberSupervisorUserId } from "@/lib/team-member-lead-access";
import { isClientDocumentType, type ClientDocumentTypeKey } from "@/lib/client-documents";

const SEND_SLUGS = [
  "contract_to_sell",
  "reservation_agreement",
  "letter_of_intent",
  "contact_form",
  "deed_of_sale",
  "payment_schedule",
] as const;

const REQUEST_SLUGS = [
  "valid_id",
  "proof_of_income",
  "tin",
  "birth_certificate",
  "marriage_certificate",
  "proof_of_billing",
] as const;

type Direction = "sent" | "requested";

function isSendSlug(s: string): s is (typeof SEND_SLUGS)[number] {
  return (SEND_SLUGS as readonly string[]).includes(s);
}

function isRequestSlug(s: string): s is (typeof REQUEST_SLUGS)[number] {
  return (REQUEST_SLUGS as readonly string[]).includes(s);
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

  let body: { lead_id?: unknown; direction?: unknown; document_slug?: unknown; document_name?: unknown };
  try {
    body = (await req.json()) as {
      lead_id?: unknown;
      direction?: unknown;
      document_slug?: unknown;
      document_name?: unknown;
    };
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

  const direction = body.direction === "sent" || body.direction === "requested" ? body.direction : null;
  if (!direction) {
    return Response.json({ error: "direction must be sent or requested" }, { status: 400 });
  }

  const slug = typeof body.document_slug === "string" ? body.document_slug.trim() : "";
  if (!slug) {
    return Response.json({ error: "document_slug required" }, { status: 400 });
  }

  if (direction === "sent" && !isSendSlug(slug)) {
    return Response.json({ error: "Invalid document for send" }, { status: 400 });
  }
  if (direction === "requested" && !isRequestSlug(slug)) {
    return Response.json({ error: "Invalid document for request" }, { status: 400 });
  }

  const documentName =
    typeof body.document_name === "string" && body.document_name.trim()
      ? body.document_name.trim()
      : slug;

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
  let dealAgentId: string;
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
    dealAgentId = sid;
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
    dealAgentId = aid;
  }
  const documentType = `${direction}:${slug}`;

  const { data: inserted, error: insErr } = await admin
    .from("deal_documents")
    .insert({
      lead_id: leadId,
      document_type: documentType,
      document_name: documentName,
      direction,
      agent_id: dealAgentId,
      status: "pending",
      file_url: null,
    })
    .select("id")
    .maybeSingle();

  if (insErr) {
    if (insErr.code === "23505") {
      return Response.json(
        { error: "This document action is already recorded for this deal." },
        { status: 409 },
      );
    }
    return Response.json({ error: insErr.message }, { status: 500 });
  }

  const dealDocumentId = (inserted as { id: string } | null)?.id;

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

  if (direction === "requested") {
    const clientType = mapRequestSlugToClientType(slug);
    const typesParam = encodeURIComponent(clientType);
    const nameParam = encodeURIComponent(agentName);
    const link = `/clients/${clientId}?reqAgent=${encodeURIComponent(targetAgentUserId)}&reqTypes=${typesParam}&reqAgentName=${nameParam}`;

    const { error: nErr } = await admin.from("notifications").insert({
      user_id: clientId,
      type: "document_request",
      title: `Document request from ${agentName}`,
      body: `Your agent requested: ${documentName}. Open your profile → Documents to share it.`,
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
  } else {
    const link = `/clients/${clientId}`;
    const { error: nErr } = await admin.from("notifications").insert({
      user_id: clientId,
      type: "document_shared",
      title: `Document from ${agentName}`,
      body: `Your agent will share “${documentName}” with you for this deal. Check back soon or open your profile for updates.`,
      metadata: {
        link,
        lead_id: leadId,
        deal_document_id: dealDocumentId,
        document_name: documentName,
        pending: true,
        agent_name: agentName,
      },
    });

    if (nErr) {
      return Response.json({ error: nErr.message }, { status: 500 });
    }
  }

  return Response.json({ success: true, id: dealDocumentId });
}

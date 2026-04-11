import { randomUUID } from "node:crypto";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "client") {
    return Response.json({ error: "Only clients can send" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const agentUserIdRaw = formData.get("agent_user_id");
  const leadIdRaw = formData.get("lead_id");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File must be 10MB or smaller" }, { status: 400 });
  }

  const agentUserId =
    typeof agentUserIdRaw === "string" ? agentUserIdRaw.trim() : "";
  if (!agentUserId) {
    return Response.json({ error: "agent_user_id required" }, { status: 400 });
  }

  const leadId =
    typeof leadIdRaw === "string" && leadIdRaw.trim()
      ? parseInt(leadIdRaw.trim(), 10)
      : typeof leadIdRaw === "number"
        ? leadIdRaw
        : NaN;

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const clientId = session.userId;

  if (Number.isFinite(leadId)) {
    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .select("id, client_id, agent_id")
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr) {
      return Response.json({ error: leadErr.message }, { status: 500 });
    }
    if (!lead) {
      return Response.json({ error: "Lead not found" }, { status: 404 });
    }
    const l = lead as { client_id: string | null; agent_id: string | null };
    if (l.client_id !== clientId) {
      return Response.json({ error: "Not your inquiry" }, { status: 403 });
    }
    if (l.agent_id && l.agent_id !== agentUserId) {
      return Response.json({ error: "Agent does not match this inquiry" }, { status: 400 });
    }
  }

  const ext =
    file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
  const path = `${clientId}/to-agent/${randomUUID()}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());
  const fileName = file.name?.trim() || `document.${ext}`;

  const { error: uploadError } = await admin.storage.from("client-docs").upload(path, body, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: clientProf } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", clientId)
    .maybeSingle();

  const clientName =
    (clientProf as { full_name?: string | null } | null)?.full_name?.trim() || "A client";

  const leadIdMeta = Number.isFinite(leadId) ? leadId : null;

  const { error: nErr } = await admin.from("notifications").insert({
    user_id: agentUserId,
    type: "document_shared",
    title: `${clientName} sent you a document`,
    body: "Check your pipeline for the uploaded document.",
    metadata: {
      file_url: path,
      file_name: fileName,
      lead_id: leadIdMeta,
      link: "/dashboard/agent?tab=pipeline",
      client_user_id: clientId,
    },
  });

  if (nErr) {
    return Response.json({ error: nErr.message }, { status: 500 });
  }

  const { data: agentProf } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", agentUserId)
    .maybeSingle();

  const agentDisplay =
    (agentProf as { full_name?: string | null } | null)?.full_name?.trim() || "your agent";

  await admin.from("activity_log").insert({
    actor_id: clientId,
    action: "client_document_sent_to_agent",
    entity_type: "outbound_client_document",
    entity_id: path,
    metadata: {
      file_url: path,
      file_name: fileName,
      lead_id: leadIdMeta,
      agent_user_id: agentUserId,
      agent_name: agentDisplay,
    },
  });

  return Response.json({ success: true, path, file_name: fileName });
}

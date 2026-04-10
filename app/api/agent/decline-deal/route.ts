import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const REASON_LABEL: Record<string, string> = {
  unavailable: "Property is no longer available",
  mismatch: "Client requirements don't match",
  no_response: "No response from client",
  other: "Other",
};

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "broker" && session.role !== "admin") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    lead_id?: unknown;
    reason_key?: unknown;
  };
  const leadId = typeof body.lead_id === "number" ? body.lead_id : Number(body.lead_id);
  const reasonKey = typeof body.reason_key === "string" ? body.reason_key.trim() : "";
  if (!Number.isFinite(leadId) || leadId < 1) {
    return Response.json({ error: "lead_id required" }, { status: 400 });
  }
  if (!reasonKey || !(reasonKey in REASON_LABEL)) {
    return Response.json({ error: "reason_key required" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const uid = session.userId;
  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, agent_id, broker_id, client_id, name")
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
  const allowed = session.role === "admin" || agentId === uid || brokerId === uid;
  if (!allowed) {
    return Response.json({ error: "Not your lead" }, { status: 403 });
  }

  const reasonText = REASON_LABEL[reasonKey] ?? reasonKey;

  const { error: updErr } = await admin
    .from("leads")
    .update({ pipeline_stage: "declined" })
    .eq("id", leadId);

  if (updErr) {
    return Response.json({ error: updErr.message }, { status: 500 });
  }

  const clientId = (lead as { client_id: string | null }).client_id;
  const clientName = String((lead as { name?: string | null }).name ?? "there").trim() || "there";

  if (clientId) {
    const { error: nErr } = await admin.from("notifications").insert({
      user_id: clientId,
      type: "deal_declined",
      title: "Update on your property inquiry",
      body: `The agent has closed this inquiry. Reason: ${reasonText}. You can search for other properties on BahayGo.`,
      metadata: {
        lead_id: leadId,
        reason_key: reasonKey,
        reason: reasonText,
      },
    });
    if (nErr) {
      return Response.json(
        { error: `Lead updated but notification failed: ${nErr.message}` },
        { status: 500 },
      );
    }
  }

  return Response.json({ ok: true, client_name: clientName });
}

import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const SIGNED_SEC = 3600;

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "broker" && session.role !== "admin") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { file_url?: unknown };
  const file_url = typeof body.file_url === "string" ? body.file_url.trim() : "";
  if (!file_url) {
    return Response.json({ error: "file_url required" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const { data: doc, error: docErr } = await admin
    .from("deal_documents")
    .select("lead_id")
    .eq("file_url", file_url)
    .maybeSingle();

  if (docErr) {
    return Response.json({ error: docErr.message }, { status: 500 });
  }
  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const leadId = (doc as { lead_id: number }).lead_id;

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, agent_id, broker_id")
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
  const uid = session.userId;
  const allowed =
    session.role === "admin" || agentId === uid || brokerId === uid;
  if (!allowed) {
    return Response.json({ error: "Not your lead" }, { status: 403 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("deals")
    .createSignedUrl(file_url, SIGNED_SEC);

  if (signErr || !signed?.signedUrl) {
    return Response.json(
      { error: signErr?.message ?? "Could not create signed URL" },
      { status: 500 },
    );
  }

  return Response.json({ signedUrl: signed.signedUrl });
}

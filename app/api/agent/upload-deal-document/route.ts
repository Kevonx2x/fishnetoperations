import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "admin" && session.role !== "broker") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const leadIdRaw = formData.get("lead_id");
  const documentTypeRaw = formData.get("document_type");
  const agentIdForm = formData.get("agent_id");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "file required" }, { status: 400 });
  }

  const leadId =
    typeof leadIdRaw === "string" ? parseInt(leadIdRaw, 10) : Number(leadIdRaw);
  if (!Number.isFinite(leadId)) {
    return Response.json({ error: "lead_id required" }, { status: 400 });
  }

  const documentType =
    typeof documentTypeRaw === "string" ? documentTypeRaw.trim() : "";
  if (!documentType) {
    return Response.json({ error: "document_type required" }, { status: 400 });
  }

  if (typeof agentIdForm !== "string" || !agentIdForm.trim()) {
    return Response.json({ error: "agent_id required" }, { status: 400 });
  }
  if (agentIdForm.trim() !== session.userId && session.role !== "admin") {
    return Response.json({ error: "Invalid agent" }, { status: 403 });
  }

  const sb = await createSupabaseServerClient();
  const { data: lead, error: leadErr } = await sb
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

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const ext =
    file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "pdf";
  const path = `${leadId}/${documentType}.${ext}`;

  const body = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from("deals").upload(path, body, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: dbError } = await admin.from("deal_documents").upsert(
    {
      lead_id: leadId,
      document_type: documentType,
      file_url: path,
      status: "uploaded",
    },
    { onConflict: "lead_id,document_type" },
  );

  if (dbError) {
    return Response.json({ error: dbError.message }, { status: 500 });
  }

  return Response.json({ success: true, path });
}

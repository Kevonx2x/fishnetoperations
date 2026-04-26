import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "client") {
    return Response.json({ error: "Clients only" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const dealDocumentIdRaw = formData.get("deal_document_id");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "file required" }, { status: 400 });
  }

  const dealDocumentId =
    typeof dealDocumentIdRaw === "string" ? dealDocumentIdRaw.trim() : "";
  if (!dealDocumentId) {
    return Response.json({ error: "deal_document_id required" }, { status: 400 });
  }

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const { data: doc, error: docErr } = await admin
    .from("deal_documents")
    .select("id, lead_id, document_type")
    .eq("id", dealDocumentId)
    .maybeSingle();

  if (docErr) {
    return Response.json({ error: docErr.message }, { status: 500 });
  }
  if (!doc) {
    return Response.json({ error: "Document request not found" }, { status: 404 });
  }

  const leadId = (doc as { lead_id: number }).lead_id;

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, client_id")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) {
    return Response.json({ error: leadErr.message }, { status: 500 });
  }
  if (!lead || (lead as { client_id: string | null }).client_id !== session.userId) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const ext =
    file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "pdf";
  const path = `${leadId}/${dealDocumentId}.${ext}`;

  const bodyBuf = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from("deals").upload(path, bodyBuf, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const fileName = file.name?.trim() || null;

  const { error: updErr } = await admin
    .from("deal_documents")
    .update({
      file_url: path,
      file_name: fileName,
      status: "uploaded",
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealDocumentId);

  if (updErr) {
    return Response.json({ error: updErr.message }, { status: 500 });
  }

  return Response.json({ success: true, path });
}

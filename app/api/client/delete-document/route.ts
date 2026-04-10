import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isClientDocumentType } from "@/lib/client-documents";

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "client") {
    return Response.json({ error: "Only clients can delete" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { document_type?: unknown };
  const documentType =
    typeof body.document_type === "string" ? body.document_type.trim() : "";
  if (!documentType || !isClientDocumentType(documentType)) {
    return Response.json({ error: "Invalid document_type" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const clientId = session.userId;

  const { data: row, error: selErr } = await admin
    .from("client_documents")
    .select("id, file_url")
    .eq("client_id", clientId)
    .eq("document_type", documentType)
    .maybeSingle();

  if (selErr) {
    return Response.json({ error: selErr.message }, { status: 500 });
  }
  if (!row) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const path = (row as { file_url: string }).file_url.trim();
  if (path) {
    const { error: rmErr } = await admin.storage.from("client-docs").remove([path]);
    if (rmErr) {
      return Response.json({ error: rmErr.message }, { status: 500 });
    }
  }

  const { error: delErr } = await admin.from("client_documents").delete().eq("id", (row as { id: string }).id);
  if (delErr) {
    return Response.json({ error: delErr.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

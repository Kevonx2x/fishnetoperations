import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isClientDocumentType } from "@/lib/client-documents";

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "client") {
    return Response.json({ error: "Only clients can unshare" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    document_type?: unknown;
    agent_user_id?: unknown;
  };
  const documentType =
    typeof body.document_type === "string" ? body.document_type.trim() : "";
  const agentUserId =
    typeof body.agent_user_id === "string" ? body.agent_user_id.trim() : "";
  if (!documentType || !isClientDocumentType(documentType)) {
    return Response.json({ error: "Invalid document_type" }, { status: 400 });
  }
  if (!agentUserId) {
    return Response.json({ error: "agent_user_id required" }, { status: 400 });
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
    .select("id, shared_with")
    .eq("client_id", clientId)
    .eq("document_type", documentType)
    .maybeSingle();

  if (selErr) {
    return Response.json({ error: selErr.message }, { status: 500 });
  }
  if (!row) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const prev = (row as { shared_with?: string[] | null }).shared_with ?? [];
  const next = prev.filter((id) => id !== agentUserId);

  const { error: upErr } = await admin
    .from("client_documents")
    .update({
      shared_with: next,
      status: next.length > 0 ? "shared" : "private",
    })
    .eq("id", (row as { id: string }).id);

  if (upErr) {
    return Response.json({ error: upErr.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

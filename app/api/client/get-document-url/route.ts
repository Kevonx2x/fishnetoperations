import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Signed URL for agents (or brokers/admins) to view a client-docs object
 * when the row is shared with them via `client_documents.shared_with`.
 */
export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
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

  if (session.role === "client") {
    const { data: doc, error: qErr } = await admin
      .from("client_documents")
      .select("id, document_type, file_name")
      .eq("file_url", file_url)
      .eq("client_id", session.userId)
      .maybeSingle();

    if (qErr) {
      return Response.json({ error: qErr.message }, { status: 500 });
    }
    if (!doc) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("client-docs")
      .createSignedUrl(file_url, 3600);

    if (signErr || !signed?.signedUrl) {
      return Response.json(
        { error: signErr?.message ?? "Could not create signed URL" },
        { status: 500 },
      );
    }

    const cdoc = doc as { id: string; document_type: string; file_name: string | null };
    const accessedAt = new Date().toISOString();
    await admin.from("activity_log").insert({
      actor_id: session.userId,
      action: "document_viewed",
      entity_type: "client_document",
      entity_id: cdoc.id,
      metadata: {
        document_type: cdoc.document_type,
        lead_id: null,
        file_name: cdoc.file_name ?? null,
        accessed_at: accessedAt,
      },
    });

    return Response.json({ signedUrl: signed.signedUrl });
  }

  if (session.role !== "agent" && session.role !== "broker" && session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: doc, error: qErr } = await admin
    .from("client_documents")
    .select("id, document_type, file_name")
    .eq("file_url", file_url)
    .contains("shared_with", [session.userId])
    .maybeSingle();

  if (qErr) {
    return Response.json({ error: qErr.message }, { status: 500 });
  }
  if (!doc) {
    return Response.json({ error: "Document not found or not shared with you" }, { status: 403 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("client-docs")
    .createSignedUrl(file_url, 3600);

  if (signErr || !signed?.signedUrl) {
    return Response.json(
      { error: signErr?.message ?? "Could not create signed URL" },
      { status: 500 },
    );
  }

  const cdoc = doc as { id: string; document_type: string; file_name: string | null };
  const accessedAt = new Date().toISOString();
  await admin.from("activity_log").insert({
    actor_id: session.userId,
    action: "document_viewed",
    entity_type: "client_document",
    entity_id: cdoc.id,
    metadata: {
      document_type: cdoc.document_type,
      lead_id: null,
      file_name: cdoc.file_name ?? null,
      accessed_at: accessedAt,
    },
  });

  return Response.json({ signedUrl: signed.signedUrl });
}

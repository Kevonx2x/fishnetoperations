import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isClientDocumentType, labelForClientDocType } from "@/lib/client-documents";

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "client") {
    return Response.json({ error: "Only clients can share" }, { status: 403 });
  }

  let body: { agent_user_id?: unknown; document_types?: unknown };
  try {
    body = (await req.json()) as { agent_user_id?: unknown; document_types?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agentUserId =
    typeof body.agent_user_id === "string" ? body.agent_user_id.trim() : "";
  if (!agentUserId) {
    return Response.json({ error: "agent_user_id required" }, { status: 400 });
  }

  const rawTypes = body.document_types;
  if (!Array.isArray(rawTypes) || rawTypes.length === 0) {
    return Response.json({ error: "document_types required" }, { status: 400 });
  }

  const documentTypes = rawTypes
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t): t is string => Boolean(t && isClientDocumentType(t)));

  if (documentTypes.length === 0) {
    return Response.json({ error: "No valid document types" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const clientId = session.userId;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", clientId)
    .maybeSingle();

  const clientName =
    (profile as { full_name?: string | null } | null)?.full_name?.trim() || "A client";

  for (const dt of documentTypes) {
    const { data: row, error: selErr } = await admin
      .from("client_documents")
      .select("id, shared_with")
      .eq("client_id", clientId)
      .eq("document_type", dt)
      .maybeSingle();

    if (selErr) {
      return Response.json({ error: selErr.message }, { status: 500 });
    }
    if (!row) {
      return Response.json(
        { error: `Upload "${labelForClientDocType(dt)}" before sharing.` },
        { status: 400 },
      );
    }

    const prev = (row as { shared_with?: string[] | null }).shared_with ?? [];
    const next = [...new Set([...prev, agentUserId])];

    const { error: upErr } = await admin
      .from("client_documents")
      .update({ shared_with: next, status: "shared" })
      .eq("id", (row as { id: string }).id);

    if (upErr) {
      return Response.json({ error: upErr.message }, { status: 500 });
    }
  }

  const { error: nErr } = await admin.from("notifications").insert({
    user_id: agentUserId,
    type: "document_shared",
    title: `${clientName} shared documents`,
    body: "Documents are now available in your pipeline for this deal.",
    metadata: { link: "/dashboard/agent?tab=pipeline", client_user_id: clientId },
  });

  if (nErr) {
    return Response.json({ error: nErr.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

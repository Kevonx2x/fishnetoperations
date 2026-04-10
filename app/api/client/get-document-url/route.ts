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
  if (session.role !== "agent" && session.role !== "broker" && session.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
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

  const { data: doc, error: qErr } = await admin
    .from("client_documents")
    .select("id")
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

  return Response.json({ signedUrl: signed.signedUrl });
}

import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const SIGNED_SEC = 3600;

type DealDocRow = {
  id: string;
  lead_id: number;
  document_type: string;
  file_name: string | null;
  file_url: string | null;
};

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "client") {
    return Response.json({ error: "Clients only" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { file_url?: unknown; deal_document_id?: unknown };
  const file_url = typeof body.file_url === "string" ? body.file_url.trim() : "";
  const deal_document_id =
    typeof body.deal_document_id === "string" ? body.deal_document_id.trim() : "";

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  let doc: DealDocRow | null = null;

  if (deal_document_id) {
    const { data, error } = await admin
      .from("deal_documents")
      .select("id, lead_id, document_type, file_name, file_url")
      .eq("id", deal_document_id)
      .maybeSingle();
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    doc = data as DealDocRow;
  } else if (file_url) {
    const { data, error } = await admin
      .from("deal_documents")
      .select("id, lead_id, document_type, file_name, file_url")
      .eq("file_url", file_url)
      .maybeSingle();
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    doc = data as DealDocRow;
  } else {
    return Response.json({ error: "deal_document_id or file_url required" }, { status: 400 });
  }

  if (!doc) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  if (!doc.file_url?.trim()) {
    return Response.json({ error: "No file on this document yet" }, { status: 400 });
  }

  const leadId = doc.lead_id;
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

  const { data: signed, error: signErr } = await admin.storage
    .from("deals")
    .createSignedUrl(doc.file_url.trim(), SIGNED_SEC);

  if (signErr || !signed?.signedUrl) {
    return Response.json(
      { error: signErr?.message ?? "Could not create signed URL" },
      { status: 500 },
    );
  }

  return Response.json({ signedUrl: signed.signedUrl });
}

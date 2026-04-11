import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isClientDocumentType, labelForClientDocType } from "@/lib/client-documents";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "client") {
    return Response.json({ error: "Only clients can upload" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const documentTypeRaw = formData.get("document_type");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "File must be 10MB or smaller" }, { status: 400 });
  }

  const documentType =
    typeof documentTypeRaw === "string" ? documentTypeRaw.trim() : "";
  if (!documentType || !isClientDocumentType(documentType)) {
    return Response.json({ error: "Invalid document_type" }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase();
  const okMime =
    mime.startsWith("image/") ||
    mime === "application/pdf" ||
    mime === "application/x-pdf";
  if (!okMime) {
    return Response.json({ error: "Only images or PDF are allowed" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const ext =
    file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) ||
    (mime.includes("pdf") ? "pdf" : "jpg");
  const path = `${session.userId}/${documentType}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from("client-docs").upload(path, body, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const fileName = file.name?.trim() || `${documentType}.${ext}`;

  const { data: existing, error: exErr } = await admin
    .from("client_documents")
    .select("id, shared_with")
    .eq("client_id", session.userId)
    .eq("document_type", documentType)
    .maybeSingle();

  if (exErr) {
    return Response.json({ error: exErr.message }, { status: 500 });
  }

  let docId: string;
  if (existing) {
    const shared = (existing as { shared_with?: string[] | null }).shared_with ?? [];
    docId = (existing as { id: string }).id;
    const { error: upErr } = await admin
      .from("client_documents")
      .update({
        file_url: path,
        file_name: fileName,
        status: shared.length > 0 ? "shared" : "private",
      })
      .eq("id", docId);
    if (upErr) {
      return Response.json({ error: upErr.message }, { status: 500 });
    }
  } else {
    const { data: ins, error: insErr } = await admin
      .from("client_documents")
      .insert({
        client_id: session.userId,
        document_type: documentType,
        file_url: path,
        file_name: fileName,
        status: "private",
      })
      .select("id")
      .single();
    if (insErr) {
      return Response.json({ error: insErr.message }, { status: 500 });
    }
    docId = (ins as { id: string }).id;
  }

  await admin.from("activity_log").insert({
    actor_id: session.userId,
    action: "client_document_uploaded",
    entity_type: "client_document",
    entity_id: docId,
    metadata: {
      document_type: documentType,
      document_label: labelForClientDocType(documentType),
    },
  });

  return Response.json({ success: true, path, file_name: fileName });
}

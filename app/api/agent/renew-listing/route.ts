import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPropertyListingRemoved } from "@/lib/property-soft-delete";

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "broker" && session.role !== "admin") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  let body: { property_id?: unknown };
  try {
    body = (await req.json()) as { property_id?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const propertyId = typeof body.property_id === "string" ? body.property_id.trim() : "";
  if (!propertyId) {
    return Response.json({ error: "property_id required" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const { data: row, error: selErr } = await sb
    .from("properties")
    .select("id, listed_by, deleted_at")
    .eq("id", propertyId)
    .maybeSingle();

  if (selErr) {
    return Response.json({ error: selErr.message }, { status: 500 });
  }
  if (!row) {
    return Response.json({ error: "Property not found" }, { status: 404 });
  }
  if (isPropertyListingRemoved(row as { deleted_at?: string | null })) {
    return Response.json({ error: "This listing has been removed." }, { status: 400 });
  }
  if ((row as { listed_by: string | null }).listed_by !== session.userId && session.role !== "admin") {
    return Response.json({ error: "Not your listing" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { error: upErr } = await sb
    .from("properties")
    .update({
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      renewed_at: now,
      expiry_notified_at: null,
    })
    .eq("id", propertyId);

  if (upErr) {
    return Response.json({ error: upErr.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

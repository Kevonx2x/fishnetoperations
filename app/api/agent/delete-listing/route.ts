import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Body = {
  property_id?: unknown;
};

/**
 * Delete an agent-owned listing and associated rows, bypassing client RLS noise.
 * Mirrors the ordered deletes previously done in the browser via supabase-js.
 */
export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "admin" && session.role !== "broker") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const propertyId = typeof body.property_id === "string" ? body.property_id.trim() : "";
  if (!propertyId) {
    return Response.json({ error: "property_id required" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const { data: prop, error: propErr } = await sb
    .from("properties")
    .select("id, listed_by")
    .eq("id", propertyId)
    .maybeSingle();

  if (propErr) {
    return Response.json({ error: propErr.message }, { status: 500 });
  }
  if (!prop) {
    return Response.json({ error: "Property not found" }, { status: 404 });
  }

  const listedBy = (prop as { listed_by: string | null }).listed_by;
  if (listedBy !== session.userId && session.role !== "admin") {
    return Response.json({ error: "Not your listing" }, { status: 403 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const orderedDeletes = [
    { label: "co_agent_requests", run: () => admin.from("co_agent_requests").delete().eq("property_id", propertyId) },
    { label: "property_agents", run: () => admin.from("property_agents").delete().eq("property_id", propertyId) },
    { label: "property_photos", run: () => admin.from("property_photos").delete().eq("property_id", propertyId) },
    { label: "viewing_requests", run: () => admin.from("viewing_requests").delete().eq("property_id", propertyId) },
    { label: "leads", run: () => admin.from("leads").delete().eq("property_id", propertyId) },
  ] as const;

  for (const step of orderedDeletes) {
    const { error } = await step.run();
    if (error) {
      return Response.json(
        { error: `Could not delete listing (${step.label}): ${error.message}` },
        { status: 500 },
      );
    }
  }

  let delQuery = admin.from("properties").delete().eq("id", propertyId);
  if (session.role !== "admin") {
    delQuery = delQuery.eq("listed_by", session.userId);
  }
  const { error: delPropErr } = await delQuery;
  if (delPropErr) {
    return Response.json({ error: delPropErr.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Body = {
  property_id?: unknown;
};

/**
 * Soft-delete an agent-owned listing: sets `deleted_at` and preserves all rows for analytics.
 * Child tables (photos, leads, etc.) are not removed.
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
    .select("id, listed_by, name, location")
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

  const deletedAt = new Date().toISOString();
  let upd = admin
    .from("properties")
    .update({ deleted_at: deletedAt, availability_state: "removed" })
    .eq("id", propertyId);
  if (session.role !== "admin") {
    upd = upd.eq("listed_by", session.userId);
  }
  const { error: updErr } = await upd;
  if (updErr) {
    return Response.json({ error: updErr.message }, { status: 500 });
  }

  // Cascade: when an agent archives a listing, notify active client leads tied to it.
  // Active = not closed/declined. We do NOT mutate lead archive flags (client keeps it in Active).
  const listingName =
    (prop as { name?: string | null; location?: string | null } | null)?.name?.trim() ||
    (prop as { name?: string | null; location?: string | null } | null)?.location?.trim() ||
    "this property";
  const { data: leadRows, error: leadsErr } = await admin
    .from("leads")
    .select("id, client_id, pipeline_stage")
    .eq("property_id", propertyId)
    .not("pipeline_stage", "in", "(closed,declined)");
  if (!leadsErr && leadRows && leadRows.length > 0) {
    const leads = leadRows as {
      id: number;
      client_id: string | null;
      pipeline_stage: string | null;
    }[];
    const notifRows = leads
      .map((l) => {
        const clientId = String(l.client_id ?? "").trim();
        if (!clientId) return null;
        return {
          user_id: clientId,
          type: "deal_pipeline",
          title: "Update on your property inquiry",
          body: "The agent has closed this inquiry. The property is no longer available. You can search for other listings on BahayGo.",
          parent_id: Number(l.id),
          metadata: {
            property_id: propertyId,
            listing_name: listingName,
            action: "property_unavailable",
            lead_id: Number(l.id),
            link: "/dashboard/client?tab=pipeline",
          },
        };
      })
      .filter(Boolean) as Record<string, unknown>[];
    if (notifRows.length > 0) {
      const { error: notifErr } = await admin.from("notifications").insert(notifRows);
      if (notifErr) {
        console.error("[agent/delete-listing] client notification insert failed", notifErr.message);
      }
    }
  } else if (leadsErr) {
    console.error("[agent/delete-listing] cascade lead select failed", leadsErr.message);
  }

  return Response.json({ ok: true, deleted_at: deletedAt });
}

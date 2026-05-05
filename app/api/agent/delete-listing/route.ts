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

  // Cascade: when an agent archives a listing, auto-archive active client leads tied to it.
  // Active = not closed/declined, and not already archived (archived_at is null).
  const listingName =
    (prop as { name?: string | null; location?: string | null } | null)?.name?.trim() ||
    (prop as { name?: string | null; location?: string | null } | null)?.location?.trim() ||
    "this property";
  const nowIso = deletedAt;
  const { data: leadRows, error: leadsErr } = await admin
    .from("leads")
    .select("id, client_id, pipeline_stage, archived_at")
    .eq("property_id", propertyId)
    .is("archived_at", null)
    .not("pipeline_stage", "in", "(closed,declined)");
  if (!leadsErr && leadRows && leadRows.length > 0) {
    const leads = leadRows as {
      id: number;
      client_id: string | null;
      pipeline_stage: string | null;
      archived_at: string | null;
    }[];
    const ids = leads.map((l) => Number(l.id)).filter((x) => Number.isFinite(x));
    if (ids.length > 0) {
      const stageById = new Map<number, string>();
      for (const l of leads) {
        const stage = String(l.pipeline_stage ?? "lead").toLowerCase();
        stageById.set(Number(l.id), stage);
      }

      // Best-effort: bulk update; store snapshot stage for each row (fallback uses current stage string).
      // Note: Supabase update cannot set stage_at_archive per-row in a single statement; set a generic value,
      // then patch rows individually only when needed.
      await admin
        .from("leads")
        .update({
          archived_by_client: false,
          archived_at: nowIso,
          archive_reason: "property_unavailable",
          archive_note: "The agent archived this listing. The property may no longer be available.",
          stage_at_archive: null,
          updated_at: nowIso,
        })
        .in("id", ids);

      // Patch `stage_at_archive` per-lead (small N, keeps display accurate).
      await Promise.all(
        ids.map(async (leadId) => {
          const stage = stageById.get(leadId) ?? "lead";
          const normalized = ["lead", "viewing", "offer", "reservation", "closed"].includes(stage) ? stage : "lead";
          await admin
            .from("leads")
            .update({ stage_at_archive: normalized, updated_at: nowIso })
            .eq("id", leadId);
        }),
      );

      const notifRows = leads
        .map((l) => {
          const clientId = String(l.client_id ?? "").trim();
          if (!clientId) return null;
          return {
            user_id: clientId,
            type: "deal_pipeline",
            title: "Update on your property inquiry",
            body: "The agent has closed this inquiry. Reason: Property is no longer available. You can search for other properties on BahayGo.",
            parent_id: Number(l.id),
            metadata: {
              property_id: propertyId,
              listing_name: listingName,
              action: "auto_archived_property_unavailable",
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
    }
  } else if (leadsErr) {
    console.error("[agent/delete-listing] cascade lead select failed", leadsErr.message);
  }

  return Response.json({ ok: true, deleted_at: deletedAt });
}

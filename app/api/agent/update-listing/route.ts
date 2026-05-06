import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { logActivity, upsertListingEditedActivity } from "@/lib/activity-log";
import { normalizeCity } from "@/lib/normalize-city";
import { isPropertyListingRemoved } from "@/lib/property-soft-delete";
import { duplicateExistingFromRpcRow } from "@/lib/duplicate-listing";

const PROPERTY_TYPES = [
  "House",
  "Condo",
  "Apartment",
  "Studio",
  "Commercial",
  "Villa",
  "Townhouse",
  "Land",
  "Presale",
] as const;
const LISTING_STATUSES = ["active", "under_offer", "sold", "off_market"] as const;

const bodySchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().max(300).nullable().optional(),
  location: z.string().min(1).max(500),
  price: z.union([z.string().min(1).max(100), z.number()]),
  beds: z.number().int().min(0).max(99),
  baths: z.number().int().min(0).max(99),
  sqft: z.string().max(80),
  property_type: z.enum(PROPERTY_TYPES),
  status: z.enum(["for_sale", "for_rent", "both"]),
  listing_type: z.enum(["sale", "rent", "both"]).optional(),
  rent_price: z.union([z.string().max(100), z.number()]).nullable().optional(),
  listing_status: z.enum(LISTING_STATUSES),
  description: z.string().max(20000).nullable().optional(),
  /** Ordered gallery: [0] = main `image_url`; rest → `property_photos`. Max 10. */
  imageUrls: z.array(z.string().min(1).max(2000)).max(10).optional(),
  is_presale: z.boolean().optional(),
  developer_name: z.string().max(300).nullable().optional(),
  turnover_date: z.string().max(32).nullable().optional(),
  unit_types: z.array(z.string().min(1).max(32)).max(20).optional(),
  lat: z.number().finite().nullable().optional(),
  lng: z.number().finite().nullable().optional(),
  formatted_address: z.string().max(500).nullable().optional(),
  place_id: z.string().max(256).nullable().optional(),
  city: z.string().max(200).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) {
      return fail("UNAUTHORIZED", "Sign in required", 401);
    }
    if (session.role !== "agent" && session.role !== "admin") {
      return fail("FORBIDDEN", "Agents only", 403);
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fromZodError(parsed.error);

    const sb = await createSupabaseServerClient();
    const { data: prop, error: propErr } = await sb
      .from("properties")
      .select("id, listed_by, name, deleted_at")
      .eq("id", parsed.data.propertyId)
      .maybeSingle();

    if (propErr) return fail("DATABASE_ERROR", propErr.message, 500);
    if (!prop) return fail("NOT_FOUND", "Property not found", 404);
    if (isPropertyListingRemoved(prop as { deleted_at?: string | null })) {
      return fail("BAD_REQUEST", "This listing has been removed and cannot be edited.", 400);
    }

    const listedBy = (prop as { listed_by: string | null }).listed_by;
    const isOwner = listedBy === session.userId;

    let isCoAgent = false;
    if (!isOwner) {
      const { data: myAgent, error: maErr } = await sb
        .from("agents")
        .select("id")
        .eq("user_id", session.userId)
        .maybeSingle();
      if (maErr) return fail("DATABASE_ERROR", maErr.message, 500);
      const myAgentId = (myAgent as { id?: string } | null)?.id;
      if (!myAgentId) {
        return fail("FORBIDDEN", "Only the listing owner can edit this property", 403);
      }
      const { data: paLink } = await sb
        .from("property_agents")
        .select("agent_id")
        .eq("property_id", parsed.data.propertyId)
        .eq("agent_id", myAgentId)
        .maybeSingle();
      if (paLink) {
        isCoAgent = true;
      } else {
        const { data: appr } = await sb
          .from("co_agent_requests")
          .select("id")
          .eq("property_id", parsed.data.propertyId)
          .eq("agent_id", myAgentId)
          .eq("status", "approved")
          .maybeSingle();
        if (appr) isCoAgent = true;
      }
      if (!isCoAgent) {
        return fail("FORBIDDEN", "Only the listing owner can edit this property", 403);
      }
    }

    if (isCoAgent && parsed.data.imageUrls !== undefined) {
      return fail("FORBIDDEN", "Only the listing owner can change listing photos.", 403);
    }

    const priceStr =
      typeof parsed.data.price === "number" ? String(parsed.data.price) : parsed.data.price.trim();

    const listingType =
      parsed.data.listing_type ??
      (parsed.data.status === "both"
        ? "both"
        : parsed.data.status === "for_rent"
          ? "rent"
          : "sale");
    const rentRaw = parsed.data.rent_price;
    const rentStr =
      rentRaw === null || rentRaw === undefined
        ? null
        : typeof rentRaw === "number"
          ? String(rentRaw)
          : rentRaw.trim();

    const rentPriceForDb =
      listingType === "both"
        ? rentStr && rentStr.length > 0
          ? rentStr
          : null
        : listingType === "rent"
          ? rentStr && rentStr.length > 0
            ? rentStr
            : priceStr
          : null;

    const imageUrls = parsed.data.imageUrls;
    const primaryImage =
      imageUrls && imageUrls.length > 0
        ? imageUrls[0]
        : undefined;

    const isPresale = parsed.data.property_type === "Presale" || parsed.data.is_presale === true;
    const dev = parsed.data.developer_name?.trim() || null;
    const turn = parsed.data.turnover_date?.trim() || null;
    const units = parsed.data.unit_types?.length ? parsed.data.unit_types : null;

    const locTrimmed = parsed.data.location.trim();

    // TODO: add lat/lng proximity check (within 0.0001 degrees) once Maps Tier 1 wires Google Places autocomplete and starts writing coordinates
    const { data: dupRows, error: dupErr } = await sb.rpc("find_duplicate_active_property", {
      p_location: locTrimmed,
      p_lat: null,
      p_lng: null,
      p_exclude_id: parsed.data.propertyId,
    });
    if (dupErr) {
      return fail("DATABASE_ERROR", dupErr.message, 500);
    }
    const dup = (Array.isArray(dupRows) ? dupRows[0] : null) as {
      id: string;
      prop_name: string;
      prop_location: string;
      listed_by: string | null;
    } | null;
    const dupExisting = dup?.id ? await duplicateExistingFromRpcRow(sb, dup) : null;

    const cityUpd =
      parsed.data.city != null && String(parsed.data.city).trim().length > 0
        ? normalizeCity(String(parsed.data.city).trim())
        : normalizeCity(locTrimmed);
    const latUpd =
      parsed.data.lat != null &&
      parsed.data.lng != null &&
      Number.isFinite(parsed.data.lat) &&
      Number.isFinite(parsed.data.lng)
        ? parsed.data.lat
        : null;
    const lngUpd =
      parsed.data.lat != null &&
      parsed.data.lng != null &&
      Number.isFinite(parsed.data.lat) &&
      Number.isFinite(parsed.data.lng)
        ? parsed.data.lng
        : null;

    const baseUpd = sb
      .from("properties")
      .update({
        name: parsed.data.name?.trim() || null,
        location: locTrimmed,
        city: cityUpd,
        price: priceStr,
        listing_type: listingType,
        rent_price: rentPriceForDb,
        beds: parsed.data.beds,
        baths: parsed.data.baths,
        sqft: parsed.data.sqft.trim(),
        property_type: parsed.data.property_type,
        status: parsed.data.status,
        listing_status: parsed.data.listing_status,
        description: parsed.data.description?.trim() || null,
        is_presale: isPresale,
        developer_name: isPresale ? dev : null,
        turnover_date: isPresale && turn ? turn : null,
        unit_types: isPresale && units && units.length ? units : isPresale ? [] : [],
        lat: latUpd,
        lng: lngUpd,
        formatted_address: parsed.data.formatted_address?.trim() || null,
        place_id: parsed.data.place_id?.trim() || null,
        ...(isOwner && primaryImage ? { image_url: primaryImage } : {}),
      })
      .eq("id", parsed.data.propertyId);

    const { error: updErr } = await (isOwner ? baseUpd.eq("listed_by", session.userId) : baseUpd);

    if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

    if (dupExisting?.id) {
      let admin: ReturnType<typeof createSupabaseAdmin> | null = null;
      try {
        admin = createSupabaseAdmin();
      } catch {
        admin = null;
      }
      if (admin) {
        await admin
          .from("properties")
          .update({
            flagged_for_admin_review: true,
            duplicate_of_property_id: dupExisting.id,
          })
          .eq("id", parsed.data.propertyId);

        const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
        if (admins?.length) {
          const { data: actorProfile } = await admin
            .from("profiles")
            .select("full_name")
            .eq("id", session.userId)
            .maybeSingle();
          const actorName =
            (actorProfile as { full_name?: string | null } | null)?.full_name?.trim() ||
            session.email?.trim() ||
            "An agent";
          const notifRows = admins.map((a) => ({
            user_id: (a as { id: string }).id,
            type: "admin_review" as const,
            title: "Possible duplicate listing detected",
            body: `Agent ${actorName} just edited a listing that may duplicate an existing one. Review in the admin panel.`,
            metadata: { new_property_id: parsed.data.propertyId, conflicting_property_id: dupExisting.id },
          }));
          await admin.from("notifications").insert(notifRows);
        }
      }
    }

    if (isOwner && imageUrls && imageUrls.length > 0) {
      const { error: delPh } = await sb
        .from("property_photos")
        .delete()
        .eq("property_id", parsed.data.propertyId);
      if (delPh) return fail("DATABASE_ERROR", delPh.message, 500);

      const extras = imageUrls.slice(1);
      if (extras.length > 0) {
        const rows = extras.map((url, i) => ({
          property_id: parsed.data.propertyId,
          url,
          sort_order: i,
        }));
        const { error: insPh } = await sb.from("property_photos").insert(rows);
        if (insPh) return fail("DATABASE_ERROR", insPh.message, 500);
      }
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", session.userId)
      .maybeSingle();
    const { data: agentRow } = await sb.from("agents").select("id, name").eq("user_id", session.userId).maybeSingle();

    const editedByName =
      (profile as { full_name?: string | null } | null)?.full_name?.trim() ||
      (agentRow as { name?: string | null } | null)?.name?.trim() ||
      "An agent";

    const propertyName =
      parsed.data.name?.trim() ||
      (prop as { name?: string | null }).name?.trim() ||
      parsed.data.location.trim();

    const listingEditedMeta = {
      property_id: parsed.data.propertyId,
      property_name: propertyName,
      edited_by_name: editedByName,
      source: "agent_listing_edit",
    };

    let admin: ReturnType<typeof createSupabaseAdmin> | null = null;
    try {
      admin = createSupabaseAdmin();
    } catch {
      admin = null;
    }

    const logListingEditedFallback = () =>
      logActivity(sb, {
        actor_id: session.userId,
        action: "listing_edited",
        entity_type: "property",
        entity_id: parsed.data.propertyId,
        metadata: listingEditedMeta,
      });

    if (admin) {
      try {
        await upsertListingEditedActivity(admin, {
          actor_id: session.userId,
          entity_id: parsed.data.propertyId,
          metadata: listingEditedMeta,
        });
      } catch (e) {
        console.error("[update-listing] upsert listing_edited activity failed", e);
        await logListingEditedFallback();
      }
    } else {
      await logListingEditedFallback();
    }

    if (!admin) {
      return ok({
        success: true,
        coAgentsNotified: 0,
        ...(dupExisting?.id
          ? {
              warning: {
                type: "possible_duplicate" as const,
                message: "A similar listing already exists. We've flagged this for admin review just in case.",
              },
            }
          : {}),
      });
    }

    const myAgentId = (agentRow as { id?: string } | null)?.id;
    if (!myAgentId) {
      return ok({ success: true, coAgentsNotified: 0 });
    }

    const { data: links } = await admin
      .from("property_agents")
      .select("agent_id")
      .eq("property_id", parsed.data.propertyId);

    const coAgentIds = [...new Set((links ?? []).map((r) => (r as { agent_id: string }).agent_id))].filter(
      (id) => id !== myAgentId,
    );

    let notified = 0;
    for (const aid of coAgentIds) {
      const { data: co } = await admin.from("agents").select("user_id").eq("id", aid).maybeSingle();
      const uid = (co as { user_id?: string } | null)?.user_id;
      if (!uid) continue;
      const { error: nErr } = await admin.from("notifications").insert({
        user_id: uid,
        type: "general",
        title: "Listing Updated",
        body: `${editedByName} updated ${propertyName}. Please review the changes.`,
        metadata: { property_id: parsed.data.propertyId },
      });
      if (!nErr) notified += 1;
    }

    return ok({
      success: true,
      coAgentsNotified: notified,
      ...(dupExisting?.id
        ? {
            warning: {
              type: "possible_duplicate" as const,
              message: "A similar listing already exists. We've flagged this for admin review just in case.",
            },
          }
        : {}),
    });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

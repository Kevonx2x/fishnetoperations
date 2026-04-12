import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { logActivity } from "@/lib/activity-log";

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
      .select("id, listed_by, name")
      .eq("id", parsed.data.propertyId)
      .maybeSingle();

    if (propErr) return fail("DATABASE_ERROR", propErr.message, 500);
    if (!prop) return fail("NOT_FOUND", "Property not found", 404);

    const listedBy = (prop as { listed_by: string | null }).listed_by;
    if (listedBy !== session.userId) {
      return fail("FORBIDDEN", "Only the listing owner can edit this property", 403);
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

    const { error: updErr } = await sb
      .from("properties")
      .update({
        name: parsed.data.name?.trim() || null,
        location: parsed.data.location.trim(),
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
        ...(primaryImage ? { image_url: primaryImage } : {}),
      })
      .eq("id", parsed.data.propertyId)
      .eq("listed_by", session.userId);

    if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

    if (imageUrls && imageUrls.length > 0) {
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

    await logActivity(sb, {
      actor_id: session.userId,
      action: "listing_edited",
      entity_type: "property",
      entity_id: parsed.data.propertyId,
      metadata: {
        property_id: parsed.data.propertyId,
        property_name: propertyName,
        edited_by_name: editedByName,
        source: "agent_listing_edit",
      },
    });

    let admin;
    try {
      admin = createSupabaseAdmin();
    } catch {
      return ok({ success: true, coAgentsNotified: 0 });
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

    return ok({ success: true, coAgentsNotified: notified });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

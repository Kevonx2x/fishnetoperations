import { z } from "zod";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeCity } from "@/lib/normalize-city";
import { duplicateExistingFromRpcRow } from "@/lib/duplicate-listing";

const LISTING_PROPERTY_TYPES = [
  "Condo",
  "House",
  "Townhouse",
  "Lot",
  "Apartment",
  "Commercial",
  "Warehouse",
  "Office",
] as const;

const bodySchema = z.object({
  name: z.string().max(300).nullable().optional(),
  location: z.string().min(1).max(500),
  price: z.string().min(1).max(100),
  listing_type: z.enum(["sale", "rent", "both"]),
  rent_price: z.string().max(100).nullable().optional(),
  sqft: z.string().max(80),
  beds: z.number().int().min(0).max(99),
  baths: z.number().int().min(0).max(99),
  image_url: z.string().min(1).max(2000),
  status: z.enum(["for_sale", "for_rent", "both"]),
  property_type: z.enum(LISTING_PROPERTY_TYPES),
  pet_friendly: z.boolean().optional().default(false),
  near_schools: z.boolean().optional().default(false),
  family_friendly: z.boolean().optional().default(false),
  sales_status: z.string().max(80).nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
  is_presale: z.boolean().optional(),
  developer_name: z.string().max(300).nullable().optional(),
  turnover_date: z.string().max(32).nullable().optional(),
  unit_types: z.array(z.string().min(1).max(32)).max(20).optional(),
  expires_at: z.string().min(1),
  expiry_notified_at: z.null().optional(),
  source_url: z.string().max(2000).nullable().optional(),
  source_hash: z.string().max(200).nullable().optional(),
  lat: z.number().finite().nullable().optional(),
  lng: z.number().finite().nullable().optional(),
  formatted_address: z.string().max(500).nullable().optional(),
  place_id: z.string().max(256).nullable().optional(),
  /** When set (e.g. from Places), normalized for DB; otherwise derived from `location`. */
  city: z.string().max(200).nullable().optional(),
  region: z.string().max(200).nullable().optional(),
  neighborhood: z.string().max(200).nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "admin" && session.role !== "broker") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const body = parsed.data;
  const locTrimmed = body.location.trim();

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  // TODO: add lat/lng proximity check (within 0.0001 degrees) once Maps Tier 1 wires Google Places autocomplete and starts writing coordinates
  const { data: dupRows, error: dupErr } = await admin.rpc("find_duplicate_active_property", {
    p_location: locTrimmed,
    p_lat: null,
    p_lng: null,
    p_exclude_id: null,
  });

  if (dupErr) {
    return Response.json({ error: dupErr.message }, { status: 500 });
  }

  const dup = (Array.isArray(dupRows) ? dupRows[0] : null) as {
    id: string;
    prop_name: string;
    prop_location: string;
    listed_by: string | null;
  } | null;
  const dupExisting = dup?.id ? await duplicateExistingFromRpcRow(admin, dup) : null;

  const isPs = body.is_presale === true;
  const salesStatusForDb =
    body.sales_status != null && String(body.sales_status).trim().length > 0
      ? String(body.sales_status).trim()
      : isPs
        ? "Presale"
        : null;
  const lt = body.listing_type;
  const rentForDb =
    !isPs && lt === "both"
      ? body.rent_price && body.rent_price.trim()
        ? body.rent_price.trim()
        : null
      : !isPs && lt === "rent"
        ? body.price.trim()
        : null;

  const sb = await createSupabaseServerClient();
  const cityFromBody =
    body.city != null && String(body.city).trim().length > 0
      ? normalizeCity(String(body.city).trim())
      : normalizeCity(locTrimmed);
  const latIns =
    body.lat != null && body.lng != null && Number.isFinite(body.lat) && Number.isFinite(body.lng) ? body.lat : null;
  const lngIns =
    body.lat != null && body.lng != null && Number.isFinite(body.lat) && Number.isFinite(body.lng) ? body.lng : null;

  const insertRow = {
    name: body.name?.trim() || null,
    location: locTrimmed,
    city: cityFromBody,
    region: body.region?.trim() || null,
    neighborhood: body.neighborhood?.trim() || null,
    price: body.price.trim(),
    listing_type: lt,
    rent_price: rentForDb,
    sqft: body.sqft.replace(/\D/g, ""),
    beds: body.beds,
    baths: body.baths,
    image_url: body.image_url.trim(),
    status: body.status,
    listed_by: session.userId,
    property_type: body.property_type,
    sales_status: salesStatusForDb,
    description: body.description?.trim() || null,
    is_presale: isPs,
    developer_name: isPs ? body.developer_name?.trim() ?? null : null,
    turnover_date: isPs ? body.turnover_date?.trim() ?? null : null,
    unit_types: isPs ? (body.unit_types?.length ? body.unit_types : []) : [],
    expires_at: body.expires_at,
    expiry_notified_at: null as string | null,
    source_url: body.source_url?.trim() || null,
    source_hash: body.source_hash?.trim() || null,
    availability_state: "available" as const,
    lat: latIns,
    lng: lngIns,
    formatted_address: body.formatted_address?.trim() || null,
    place_id: body.place_id?.trim() || null,
    pet_friendly: body.pet_friendly,
    near_schools: body.near_schools,
    family_friendly: body.family_friendly,
  };

  const { data: newProperty, error: insErr } = await sb
    .from("properties")
    .insert(insertRow)
    .select("id")
    .single();

  if (insErr) {
    return Response.json({ error: insErr.message }, { status: 400 });
  }

  const id = (newProperty as { id?: string } | null)?.id;
  if (!id) {
    return Response.json({ error: "Insert returned no id" }, { status: 500 });
  }

  if (dupExisting?.id) {
    // Warn-not-block: allow insert, but flag for admin review.
    await admin
      .from("properties")
      .update({
        flagged_for_admin_review: true,
        duplicate_of_property_id: dupExisting.id,
      })
      .eq("id", id);

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
        body: `Agent ${actorName} just created a listing that may duplicate an existing one. Review in the admin panel.`,
        metadata: { new_property_id: id, conflicting_property_id: dupExisting.id },
      }));
      await admin.from("notifications").insert(notifRows);
    }
  }

  const { data: agentLink } = await sb.from("agents").select("id").eq("user_id", session.userId).maybeSingle();
  const linkAgentId = (agentLink as { id?: string } | null)?.id;
  if (linkAgentId) {
    const { error: paErr } = await sb.from("property_agents").insert({
      property_id: id,
      agent_id: linkAgentId,
    });
    if (paErr && paErr.code !== "23505") {
      return Response.json({ error: paErr.message, id }, { status: 500 });
    }
  }

  return Response.json({
    ok: true as const,
    id,
    property_id: id,
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

import { z } from "zod";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeCity } from "@/lib/normalize-city";
import { duplicateExistingFromRpcRow } from "@/lib/duplicate-listing";

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
  property_type: z.string().min(1).max(80),
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
  if (dup?.id) {
    const existing = await duplicateExistingFromRpcRow(admin, dup);
    return Response.json({ duplicate: true as const, existing }, { status: 409 });
  }

  const isPs = body.is_presale === true || body.property_type === "Presale";
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

  return Response.json({ ok: true as const, id });
}

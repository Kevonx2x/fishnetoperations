import { ok, fail } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { isAdminPanelRole } from "@/lib/auth-roles";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { isPropertyListingRemoved } from "@/lib/property-soft-delete";

export type PropertySummary = {
  id: string;
  name: string | null;
  address: string | null;
  /** Primary list price (sale) when applicable. */
  price: string | null;
  rent_price: string | null;
  listing_type: string | null;
  /** DB `status` (e.g. for_sale / for_rent) for display helpers. */
  listing_status: string | null;
  beds: number | null;
  baths: number | null;
  sqft: string | null;
  hero_image: string | null;
  /** Soft-deleted listing; still returned so messaging context can render a muted card. */
  listing_removed: boolean;
};

/**
 * Minimal property details used by the messaging conversation context panel.
 * Intentionally avoids returning full property payloads to keep UI fast.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return fail("UNAUTHORIZED", "Sign in required", 401);
  }

  const rawParams = await Promise.resolve(ctx.params);
  const id = (rawParams?.id ?? "").trim();
  if (!id) {
    return fail("MISSING_PARAM", "id is required", 400);
  }

  const sb = createSupabaseAdmin();
  const { data, error } = await sb
    .from("properties")
    .select(
      "id, name, location, price, rent_price, listing_type, status, beds, baths, sqft, image_url, deleted_at, is_demo, listed_by",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }
  if (!data?.id) {
    return fail("NOT_FOUND", "Property not found", 404);
  }

  const row = data as {
    is_demo?: boolean | null;
    listed_by?: string | null;
    price?: string | null;
    rent_price?: string | null;
    listing_type?: string | null;
    status?: string | null;
  };
  if (row.is_demo === true && !isAdminPanelRole(session.role) && row.listed_by !== session.userId) {
    return fail("NOT_FOUND", "Property not found", 404);
  }

  const listingRemoved = isPropertyListingRemoved(data as { deleted_at?: string | null });
  const out: PropertySummary = {
    id: data.id as string,
    name: (data.name as string | null) ?? null,
    address: (data.location as string | null) ?? null,
    price: row.price ?? null,
    rent_price: row.rent_price ?? null,
    listing_type: row.listing_type ?? null,
    listing_status: row.status ?? null,
    beds: (data.beds as number | null) ?? null,
    baths: (data.baths as number | null) ?? null,
    sqft: (data.sqft as string | null) ?? null,
    hero_image: (data.image_url as string | null) ?? null,
    listing_removed: listingRemoved,
  };

  return ok(out);
}


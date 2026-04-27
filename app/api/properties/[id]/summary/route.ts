import { ok, fail } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type PropertySummary = {
  id: string;
  name: string | null;
  address: string | null;
  price: string | null;
  beds: number | null;
  baths: number | null;
  sqft: string | null;
  hero_image: string | null;
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
    .select("id, name, location, price, beds, baths, sqft, image_url")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return fail("DATABASE_ERROR", error.message, 500);
  }
  if (!data?.id) {
    return fail("NOT_FOUND", "Property not found", 404);
  }

  const out: PropertySummary = {
    id: data.id as string,
    name: (data.name as string | null) ?? null,
    address: (data.location as string | null) ?? null,
    price: (data.price as string | null) ?? null,
    beds: (data.beds as number | null) ?? null,
    baths: (data.baths as number | null) ?? null,
    sqft: (data.sqft as string | null) ?? null,
    hero_image: (data.image_url as string | null) ?? null,
  };

  return ok(out);
}


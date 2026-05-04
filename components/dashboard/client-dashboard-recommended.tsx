import {
  ClientDashboardRecommendedClient,
  type RecommendedPropertyCardModel,
} from "@/components/dashboard/client-dashboard-recommended-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function pickPropertyImageUrl(
  imageUrl: string | null | undefined,
  photos: { url: string | null; sort_order: number | null }[] | null | undefined,
): string | null {
  const list = [...(photos ?? [])].sort(
    (a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0),
  );
  const first = list.find((ph) => ph.url?.trim());
  if (first?.url?.trim()) return first.url.trim();
  const u = imageUrl?.trim();
  return u || null;
}

type PropertyRow = {
  id: string;
  name: string | null;
  city: string | null;
  location: string | null;
  price: string;
  beds: number;
  baths: number;
  sqft: string;
  image_url: string | null;
  status: string;
  deleted_at: string | null;
  availability_state: string | null;
  property_photos: { url: string | null; sort_order: number | null }[] | null;
};

function normalizeStatus(s: string | null | undefined): RecommendedPropertyCardModel["status"] {
  const t = String(s ?? "for_sale").toLowerCase();
  if (t === "for_rent" || t === "rented") return "for_rent";
  if (t === "both") return "both";
  if (t === "sold") return "sold";
  return "for_sale";
}

export default async function ClientDashboardRecommended(props: { userId: string }) {
  const supabase = await createSupabaseServerClient();

  const { data: savedRows } = await supabase.from("saved_properties").select("property_id").eq("user_id", props.userId);

  const savedIds = new Set((savedRows ?? []).map((r: { property_id: string }) => r.property_id).filter(Boolean));

  let cities: string[] = [];
  if (savedIds.size) {
    const { data: cityRows } = await supabase
      .from("properties")
      .select("city")
      .in("id", [...savedIds])
      .not("city", "is", null);
    cities = [
      ...new Set(
        (cityRows ?? [])
          .map((r: { city: string | null }) => r.city?.trim())
          .filter((c): c is string => Boolean(c)),
      ),
    ];
  }

  let q = supabase
    .from("properties")
    .select(
      "id, created_at, name, city, location, price, beds, baths, sqft, image_url, status, deleted_at, availability_state, property_photos(url, sort_order)",
    )
    .eq("availability_state", "available")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(96);

  if (cities.length) {
    q = q.in("city", cities);
  }

  const { data: raw, error } = await q;
  if (error || !raw?.length) return null;

  const rows = (raw as PropertyRow[]).filter((p) => !savedIds.has(p.id)).slice(0, 5);
  if (!rows.length) return null;

  const items: RecommendedPropertyCardModel[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    city: p.city,
    price: p.price,
    status: normalizeStatus(p.status),
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    imageUrl: pickPropertyImageUrl(p.image_url, p.property_photos),
  }));

  return <ClientDashboardRecommendedClient items={items} />;
}

import { supabase } from "@/lib/supabase";

export type SavedPropertyCard = {
  id: string;
  location: string;
  price: string;
  status: string;
  beds: number;
  baths: number;
  sqft: string;
  image_url: string;
  deleted_at?: string | null;
  availability_state?: string | null;
  is_demo?: boolean | null;
};

export type EngagementSource = "liked" | "saved" | "both";

export type SavedListingEntry = {
  property: SavedPropertyCard;
  source: EngagementSource;
  sortAt: string;
};

function maxTimestamp(a?: string, b?: string): string {
  const ta = a ? Date.parse(a) : 0;
  const tb = b ? Date.parse(b) : 0;
  if (ta >= tb) return a ?? b ?? "";
  return b ?? a ?? "";
}

export async function fetchSavedListings(userId: string): Promise<SavedListingEntry[]> {
  const [likesRes, savesRes] = await Promise.all([
    supabase.from("property_likes").select("property_id, created_at").eq("user_id", userId),
    supabase.from("saved_properties").select("property_id, created_at").eq("user_id", userId),
  ]);

  if (likesRes.error) throw likesRes.error;
  if (savesRes.error) throw savesRes.error;

  const byProperty = new Map<string, { likedAt?: string; savedAt?: string }>();
  for (const row of likesRes.data ?? []) {
    const id = String(row.property_id);
    byProperty.set(id, { ...byProperty.get(id), likedAt: String(row.created_at) });
  }
  for (const row of savesRes.data ?? []) {
    const id = String(row.property_id);
    const prev = byProperty.get(id) ?? {};
    byProperty.set(id, { ...prev, savedAt: String(row.created_at) });
  }

  if (byProperty.size === 0) return [];

  const merged = [...byProperty.entries()]
    .map(([propertyId, times]) => {
      const liked = Boolean(times.likedAt);
      const saved = Boolean(times.savedAt);
      const source: EngagementSource = liked && saved ? "both" : liked ? "liked" : "saved";
      return {
        propertyId,
        source,
        sortAt: maxTimestamp(times.likedAt, times.savedAt),
      };
    })
    .sort((a, b) => b.sortAt.localeCompare(a.sortAt));

  const propertyIds = merged.map((m) => m.propertyId);
  const { data, error: fetchErr } = await supabase
    .from("properties")
    .select(
      "id, location, price, status, beds, baths, sqft, image_url, deleted_at, availability_state, is_demo",
    )
    .in("id", propertyIds);

  if (fetchErr) throw fetchErr;

  const list = ((data ?? []) as unknown as SavedPropertyCard[]).filter((p) => !p.is_demo);
  const byId = new Map(list.map((p) => [p.id, p]));

  return merged
    .map((m) => {
      const property = byId.get(m.propertyId);
      if (!property) return null;
      return { property, source: m.source, sortAt: m.sortAt };
    })
    .filter(Boolean) as SavedListingEntry[];
}

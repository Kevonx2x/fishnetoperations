export type DormspaceFeaturedNeighborhoodRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type BahaygoFeaturedLocationRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type UniversityVisualAssetRow = {
  id: string;
  name: string;
  short_name: string;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
};

export function slugifyVisualAssetName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type UniversityRow = {
  id: string;
  name: string;
  short_name: string;
  full_name: string | null;
  city: string;
  neighborhood: string | null;
  latitude: number;
  longitude: number;
  image_url: string | null;
  listing_count: number;
  display_order: number;
  is_active: boolean;
  created_at?: string;
};

export function formatUniversityListingCount(count: number): string {
  if (count <= 0) return "Listings coming soon";
  if (count >= 120) return "120+ listings";
  return `${count} listing${count === 1 ? "" : "s"}`;
}

export function universityInitials(shortName: string): string {
  const parts = shortName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

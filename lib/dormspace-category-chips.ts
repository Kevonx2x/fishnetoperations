import type { DormspaceBrowseFilters } from "@/components/dormspaces/dormspace-browse";
import type { DormspaceGenderPreference, DormspaceRoomType } from "@/lib/dormspaces";

export type DormspaceCategoryChip = {
  id: string;
  label: string;
  countLabel?: string;
  filters: Partial<DormspaceBrowseFilters>;
};

export const DORMSPACE_CATEGORY_CHIPS: DormspaceCategoryChip[] = [
  {
    id: "near-dlsu",
    label: "Near DLSU",
    countLabel: "Taft & Malate",
    filters: { city: "Manila", roomType: "", gender: "", minPrice: "", maxPrice: "" },
  },
  {
    id: "near-ust",
    label: "Near UST",
    countLabel: "Sampaloc",
    filters: { city: "Manila", roomType: "", gender: "", minPrice: "", maxPrice: "" },
  },
  {
    id: "near-feu",
    label: "Near FEU",
    countLabel: "Manila",
    filters: { city: "Manila", roomType: "", gender: "", minPrice: "", maxPrice: "" },
  },
  {
    id: "female",
    label: "Female only",
    filters: { city: "", roomType: "", gender: "female" as DormspaceGenderPreference, minPrice: "", maxPrice: "" },
  },
  {
    id: "male",
    label: "Male only",
    filters: { city: "", roomType: "", gender: "male" as DormspaceGenderPreference, minPrice: "", maxPrice: "" },
  },
  {
    id: "bedspace",
    label: "Bedspace",
    filters: { city: "", roomType: "shared_4" as DormspaceRoomType, gender: "", minPrice: "", maxPrice: "" },
  },
  {
    id: "private",
    label: "Private room",
    filters: { city: "", roomType: "private" as DormspaceRoomType, gender: "", minPrice: "", maxPrice: "" },
  },
  {
    id: "budget",
    label: "Under ₱5k",
    filters: { city: "", roomType: "", gender: "", minPrice: "", maxPrice: "5000" },
  },
];

import type { DormspaceGenderPreference, DormspaceRoomType } from "@/lib/dormspaces";

export type DormspaceBrowseFilters = {
  city: string;
  roomType: "" | DormspaceRoomType;
  gender: "" | DormspaceGenderPreference;
  minPrice: string;
  maxPrice: string;
  universityId: string;
  neighborhood: string;
};

export const EMPTY_DORMSPACE_BROWSE_FILTERS: DormspaceBrowseFilters = {
  city: "",
  roomType: "",
  gender: "",
  minPrice: "",
  maxPrice: "",
  universityId: "",
  neighborhood: "",
};

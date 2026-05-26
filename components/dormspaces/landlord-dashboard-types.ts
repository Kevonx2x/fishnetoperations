import type {
  DormspaceInquiryRow,
  DormspacePhotoRow,
  DormspaceRow,
} from "@/lib/dormspaces";

export type ListingItem = DormspaceRow & {
  dormspace_photos?: DormspacePhotoRow[] | null;
  thumbnail_url?: string | null;
  inquiry_count: number;
  like_count: number;
  save_count: number;
};

export type InquiryItem = DormspaceInquiryRow & {
  dormspaces?: {
    id: string;
    title: string;
    dormspace_photos?: { url: string; display_order: number }[] | null;
  } | null;
};

import { isDormspaceVisibleOnBrowse } from "@/lib/dormspace-gender-beds";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";

/** Approved listings with open beds and not landlord-hidden — for public browse only. */
export function filterDormspacesForPublicBrowse(listings: DormspaceWithPhotos[]): DormspaceWithPhotos[] {
  return listings.filter((row) => isDormspaceVisibleOnBrowse(row));
}

import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import { DormspaceSearchMapPage } from "@/components/dormspaces/dormspace-search-map-page";
import { fetchDormspaceSearchMapMarkersServer } from "@/lib/search-map-dormspaces-server";

export const metadata = {
  title: "Search | BahayGo Dormspaces",
  description: "Map search for verified student housing near campus.",
};

export default async function DormspacesSearchPage() {
  const markers = await fetchDormspaceSearchMapMarkersServer();

  return (
    <DormspacePortalShell variant="browse" mobileFillViewport>
      <DormspaceSearchMapPage markers={markers} />
    </DormspacePortalShell>
  );
}

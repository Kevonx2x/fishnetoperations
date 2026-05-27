import { DormspacePublicHomeClient } from "@/components/dormspaces/dormspace-public-home-client";
import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import { fetchDormspaceListingsServer } from "@/lib/dormspace-listings-server";
import { fetchActiveUniversitiesServer } from "@/lib/universities-server";

export const metadata = {
  title: "Dormspaces & Coliving | BahayGo",
  description:
    "Verified bedspaces and coliving rooms for students, BPO workers, and young professionals across Metro Manila.",
};

export default async function DormspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ university?: string; neighborhood?: string }>;
}) {
  const params = await searchParams;
  const [listings, universities] = await Promise.all([
    fetchDormspaceListingsServer(),
    fetchActiveUniversitiesServer(),
  ]);

  return (
    <DormspacePortalShell variant="browse">
      <main>
        <DormspacePublicHomeClient
          initialListings={listings}
          initialUniversities={universities}
          initialUniversityId={params.university?.trim() ?? ""}
          initialNeighborhood={params.neighborhood?.trim() ?? ""}
        />
      </main>
    </DormspacePortalShell>
  );
}

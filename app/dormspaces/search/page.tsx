import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import { SearchComingSoonPage } from "@/components/mobile/search-coming-soon-page";

export const metadata = {
  title: "Search | BahayGo Dormspaces",
  description: "Campus map search for student housing — coming soon.",
};

export default function DormspacesSearchPage() {
  return (
    <DormspacePortalShell variant="browse">
      <main>
        <SearchComingSoonPage variant="dormspaces" />
      </main>
    </DormspacePortalShell>
  );
}

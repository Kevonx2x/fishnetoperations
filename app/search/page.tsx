import { SearchMapPage } from "@/components/search/search-map-page";
import { fetchSearchMapPropertyMarkersServer } from "@/lib/search-map-properties-server";

export const metadata = {
  title: "Search | BahayGo",
  description: "Map search across Metro Manila on BahayGo.",
};

export default async function SearchPage() {
  const markers = await fetchSearchMapPropertyMarkersServer();
  return <SearchMapPage markers={markers} />;
}

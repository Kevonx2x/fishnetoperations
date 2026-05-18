/** Placeholder “Top Condos” cards — no navigation until building pages exist. */

export type TopCondoPlaceholder = {
  id: string;
  name: string;
  listingCount: number;
  imageUrl: string;
};

export type TopCondosSectionData = {
  title: string;
  subtitle: string;
  condos: TopCondoPlaceholder[];
};

const CONDO_IMAGES = {
  towerA:
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=280&fit=crop",
  towerB:
    "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&h=280&fit=crop",
  towerC:
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=280&fit=crop",
  towerD:
    "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400&h=280&fit=crop",
  towerE:
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=280&fit=crop",
} as const;

const MANILA_METRO_CONDOS: TopCondoPlaceholder[] = [
  { id: "uptown-ritz", name: "Uptown Ritz", listingCount: 42, imageUrl: CONDO_IMAGES.towerC },
  { id: "rockwell", name: "Rockwell Center", listingCount: 38, imageUrl: CONDO_IMAGES.towerB },
  { id: "grand-hyatt-bgc", name: "Grand Hyatt Manila", listingCount: 31, imageUrl: CONDO_IMAGES.towerC },
  { id: "shang-fort", name: "Shangri-La at the Fort", listingCount: 27, imageUrl: CONDO_IMAGES.towerA },
  { id: "rise-makati", name: "The Rise Makati", listingCount: 24, imageUrl: CONDO_IMAGES.towerB },
  { id: "salcedo-place", name: "Shang Salcedo Place", listingCount: 22, imageUrl: CONDO_IMAGES.towerB },
  { id: "serendra", name: "Serendra", listingCount: 35, imageUrl: CONDO_IMAGES.towerC },
  { id: "acqua", name: "Acqua Private Residences", listingCount: 19, imageUrl: CONDO_IMAGES.towerE },
  { id: "azure", name: "Azure Urban Residences", listingCount: 16, imageUrl: CONDO_IMAGES.towerD },
  { id: "one-shang", name: "One Shangri-La Place", listingCount: 29, imageUrl: CONDO_IMAGES.towerA },
];

const BY_LOCATION: Record<string, TopCondoPlaceholder[]> = {
  BGC: [
    { id: "bgc-uptown", name: "Uptown Ritz", listingCount: 18, imageUrl: CONDO_IMAGES.towerC },
    { id: "bgc-hyatt", name: "Grand Hyatt Manila", listingCount: 14, imageUrl: CONDO_IMAGES.towerC },
    { id: "bgc-serendra", name: "Serendra", listingCount: 22, imageUrl: CONDO_IMAGES.towerA },
    { id: "bgc-two-serendra", name: "Two Serendra", listingCount: 17, imageUrl: CONDO_IMAGES.towerC },
    { id: "bgc-bhs", name: "Bonifacio High Street", listingCount: 12, imageUrl: CONDO_IMAGES.towerC },
    { id: "bgc-essensa", name: "Essensa East Forbes", listingCount: 11, imageUrl: CONDO_IMAGES.towerA },
    { id: "bgc-icon", name: "Icon Plaza", listingCount: 9, imageUrl: CONDO_IMAGES.towerB },
    { id: "bgc-8forbes", name: "8 Forbestown", listingCount: 8, imageUrl: CONDO_IMAGES.towerC },
  ],
  Makati: [
    { id: "makati-rockwell", name: "Rockwell Center", listingCount: 26, imageUrl: CONDO_IMAGES.towerB },
    { id: "makati-rise", name: "The Rise Makati", listingCount: 19, imageUrl: CONDO_IMAGES.towerB },
    { id: "makati-salcedo", name: "Shang Salcedo Place", listingCount: 15, imageUrl: CONDO_IMAGES.towerB },
    { id: "makati-greenbelt", name: "Greenbelt Hamilton", listingCount: 13, imageUrl: CONDO_IMAGES.towerA },
    { id: "makati-discovery", name: "Discovery Primea", listingCount: 10, imageUrl: CONDO_IMAGES.towerB },
    { id: "makati-park", name: "Park Terraces", listingCount: 12, imageUrl: CONDO_IMAGES.towerA },
    { id: "makati-ayala", name: "Ayala Avenue Towers", listingCount: 21, imageUrl: CONDO_IMAGES.towerB },
    { id: "makati-legazpi", name: "Legazpi Village", listingCount: 17, imageUrl: CONDO_IMAGES.towerA },
  ],
  Ortigas: [
    { id: "ortigas-florence", name: "The Florence", listingCount: 14, imageUrl: CONDO_IMAGES.towerA },
    { id: "ortigas-mplace", name: "M Place", listingCount: 11, imageUrl: CONDO_IMAGES.towerD },
    { id: "ortigas-cyber", name: "Robinsons Cyberscape", listingCount: 9, imageUrl: CONDO_IMAGES.towerA },
    { id: "ortigas-st-francis", name: "St. Francis Towers", listingCount: 13, imageUrl: CONDO_IMAGES.towerB },
    { id: "ortigas-emerald", name: "Emerald Avenue", listingCount: 8, imageUrl: CONDO_IMAGES.towerA },
    { id: "ortigas-ortigas-center", name: "Ortigas Center", listingCount: 16, imageUrl: CONDO_IMAGES.towerD },
  ],
  "Cebu City": [
    { id: "cebu-ayala", name: "Ayala Center Cebu", listingCount: 12, imageUrl: CONDO_IMAGES.towerD },
    { id: "cebu-it", name: "IT Park Towers", listingCount: 15, imageUrl: CONDO_IMAGES.towerA },
    { id: "cebu-seda", name: "Seda Residences", listingCount: 7, imageUrl: CONDO_IMAGES.towerD },
    { id: "cebu-mandani", name: "Mandani Bay", listingCount: 10, imageUrl: CONDO_IMAGES.towerE },
    { id: "cebu-citylights", name: "Citylights Gardens", listingCount: 6, imageUrl: CONDO_IMAGES.towerD },
  ],
  Davao: [
    { id: "davao-ayala", name: "Azuela Cove", listingCount: 9, imageUrl: CONDO_IMAGES.towerE },
    { id: "davao-roc", name: "Roc Tower", listingCount: 7, imageUrl: CONDO_IMAGES.towerD },
    { id: "davao-haus", name: "The Haus Davao", listingCount: 5, imageUrl: CONDO_IMAGES.towerA },
    { id: "davao-meridian", name: "Meridian Park", listingCount: 8, imageUrl: CONDO_IMAGES.towerE },
  ],
  Tagaytay: [
    { id: "tagaytay-wind", name: "Wind Residences", listingCount: 11, imageUrl: CONDO_IMAGES.towerE },
    { id: "tagaytay-serin", name: "Serin East", listingCount: 8, imageUrl: CONDO_IMAGES.towerD },
    { id: "tagaytay-pine", name: "Pine Suites", listingCount: 6, imageUrl: CONDO_IMAGES.towerE },
    { id: "tagaytay-crosswinds", name: "Crosswinds", listingCount: 9, imageUrl: CONDO_IMAGES.towerE },
  ],
  Bacolod: [
    { id: "bacolod-lacson", name: "Lacson Street Towers", listingCount: 5, imageUrl: CONDO_IMAGES.towerD },
    { id: "bacolod-sm", name: "SM City Area", listingCount: 4, imageUrl: CONDO_IMAGES.towerA },
    { id: "bacolod-riverside", name: "Riverside Residences", listingCount: 3, imageUrl: CONDO_IMAGES.towerE },
  ],
};

export function getTopCondosSectionData(locationLabel: string | null): TopCondosSectionData {
  if (locationLabel && BY_LOCATION[locationLabel]) {
    return {
      title: `Top Condos ${locationLabel}`,
      subtitle: `Popular towers and communities in ${locationLabel}`,
      condos: BY_LOCATION[locationLabel]!,
    };
  }

  return {
    title: "Top Condos Manila",
    subtitle: "Iconic towers across the metro — BGC, Makati, Ortigas & more",
    condos: MANILA_METRO_CONDOS,
  };
}

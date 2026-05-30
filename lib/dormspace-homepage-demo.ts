/** Demo listings and campus cards for the mobile dormspaces homepage preview. */

export type DormspaceHomeDemoListing = {
  id: string;
  title: string;
  location: string;
  price: number;
  beds: number;
  baths: number;
  sqm: number;
  imageUrl: string;
  badge?: "NEW" | "HOT";
  /** Optional fixed detail route — otherwise homepage maps by index to live listings. */
  detailHref?: string;
};

export type DormspaceHomeCampusCard = {
  id: string;
  name: string;
  listingCount: string;
  walkMinutes: number;
  imageUrl: string;
};

const ROOM_A =
  "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=640&h=480&fit=crop";
const ROOM_B =
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=640&h=480&fit=crop";
const ROOM_C =
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=640&h=480&fit=crop";
const ROOM_D =
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=640&h=480&fit=crop";
const CAMPUS_A =
  "https://images.unsplash.com/photo-1562774053-701939374585?w=480&h=320&fit=crop";
const CAMPUS_B =
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3c?w=480&h=320&fit=crop";
const CAMPUS_C =
  "https://images.unsplash.com/photo-1576495199011-eb94736d770d?w=480&h=320&fit=crop";

export const DORMSPACE_HOME_DEMO_NEW: DormspaceHomeDemoListing[] = [
  {
    id: "demo-new-1",
    title: "Modern Studio Near DLSU",
    location: "Taft Ave., Malate",
    price: 12500,
    beds: 1,
    baths: 1,
    sqm: 18,
    imageUrl: ROOM_A,
    badge: "NEW",
  },
  {
    id: "demo-new-2",
    title: "Bright Bedspace · Wi-Fi",
    location: "Vito Cruz, Malate",
    price: 8500,
    beds: 1,
    baths: 1,
    sqm: 14,
    imageUrl: ROOM_B,
    badge: "NEW",
  },
  {
    id: "demo-new-3",
    title: "Shared Room · Female Only",
    location: "Taft Ave., Manila",
    price: 6500,
    beds: 2,
    baths: 1,
    sqm: 22,
    imageUrl: ROOM_C,
    badge: "NEW",
  },
];

export const DORMSPACE_HOME_DEMO_RECOMMENDED: DormspaceHomeDemoListing[] = [
  {
    id: "demo-rec-1",
    title: "Spacious Unit in Malate",
    location: "Malate, Manila",
    price: 13000,
    beds: 1,
    baths: 1,
    sqm: 20,
    imageUrl: ROOM_D,
    badge: "HOT",
  },
  {
    id: "demo-rec-2",
    title: "Walk to DLSU · AC Room",
    location: "Taft Ave.",
    price: 9800,
    beds: 1,
    baths: 1,
    sqm: 15,
    imageUrl: ROOM_A,
    badge: "HOT",
  },
  {
    id: "demo-rec-3",
    title: "Budget Bedspace · Study Nook",
    location: "Vito Cruz",
    price: 7200,
    beds: 1,
    baths: 1,
    sqm: 12,
    imageUrl: ROOM_B,
  },
];

export const DORMSPACE_HOME_DEMO_CAMPUSES: DormspaceHomeCampusCard[] = [
  {
    id: "dlsu",
    name: "DLSU Manila",
    listingCount: "120+ listings",
    walkMinutes: 6,
    imageUrl: CAMPUS_A,
  },
  {
    id: "ust",
    name: "UST Sampaloc",
    listingCount: "85+ listings",
    walkMinutes: 12,
    imageUrl: CAMPUS_B,
  },
  {
    id: "ateneo",
    name: "Ateneo Loyola",
    listingCount: "64+ listings",
    walkMinutes: 18,
    imageUrl: CAMPUS_C,
  },
];

export function formatDemoPrice(amount: number): string {
  const formatted = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(amount);
  return `₱${formatted}/mo`;
}

export function isDemoListingId(id: string): boolean {
  return id.startsWith("demo-");
}

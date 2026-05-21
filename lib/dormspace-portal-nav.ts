import { isLandlordRole } from "@/lib/auth-roles";
import { canLikeDormspaces } from "@/lib/dormspace-engagement";

export type DormspacePortalNavVariant = "browse" | "landlord";

export type DormspaceNavLinkItem = {
  key: string;
  label: string;
  href: string;
  /** Scroll to #listings on /dormspaces instead of navigating */
  scrollToListings?: boolean;
};

export function resolveDormspaceNavVariant(
  role: string | null | undefined,
  explicit?: DormspacePortalNavVariant,
): DormspacePortalNavVariant {
  if (explicit) return explicit;
  return isLandlordRole(role) ? "landlord" : "browse";
}

/** Center nav links — kept minimal per portal area. */
export function dormspaceCenterNavItems(
  variant: DormspacePortalNavVariant,
  role: string | null | undefined,
  pathname: string,
): DormspaceNavLinkItem[] {
  if (variant === "landlord") {
    return [
      { key: "listings", label: "My Listings", href: "/dormspaces/dashboard" },
      { key: "inquiries", label: "Inquiries", href: "/dormspaces/dashboard?tab=inquiries" },
      { key: "browse", label: "Browse", href: "/dormspaces" },
    ];
  }

  const items: DormspaceNavLinkItem[] = [
    {
      key: "browse",
      label: "Browse",
      href: "/dormspaces",
      scrollToListings: pathname === "/dormspaces",
    },
  ];

  if (canLikeDormspaces(role)) {
    items.push({ key: "liked", label: "Liked", href: "/dormspaces/liked" });
  }

  return items;
}

export function isDormspaceNavLinkActive(
  item: DormspaceNavLinkItem,
  pathname: string,
): boolean {
  if (item.key === "listings") {
    return pathname === "/dormspaces/dashboard";
  }
  if (item.key === "inquiries") {
    return false;
  }
  if (item.key === "browse" && pathname === "/dormspaces") return true;
  if (item.key === "liked") return pathname === "/dormspaces/liked";
  if (item.href && !item.scrollToListings) {
    const base = item.href.split("?")[0];
    return pathname === base;
  }
  return false;
}

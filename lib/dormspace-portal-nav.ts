import { isLandlordCapable, type LandlordCapableProfile } from "@/lib/auth-roles";

export type DormspacePortalNavVariant = "browse" | "landlord";

export type DormspaceNavLinkItem = {
  key: string;
  label: string;
  href: string;
  /** Scroll to #listings on /dormspaces instead of navigating */
  scrollToListings?: boolean;
};

export function resolveDormspaceNavVariant(
  profile: LandlordCapableProfile | null | undefined,
  explicit?: DormspacePortalNavVariant,
): DormspacePortalNavVariant {
  if (explicit) return explicit;
  return isLandlordCapable(profile) ? "landlord" : "browse";
}

/** Center nav links — minimal for public browse; landlord dashboard links when managing. */
export function dormspaceCenterNavItems(
  variant: DormspacePortalNavVariant,
  _role: string | null | undefined,
  _pathname: string,
): DormspaceNavLinkItem[] {
  if (variant === "landlord") {
    return [{ key: "listings", label: "My Listings", href: "/dormspaces/dashboard" }];
  }

  return [];
}

export function isDormspaceNavLinkActive(
  item: DormspaceNavLinkItem,
  pathname: string,
): boolean {
  if (item.key === "listings") {
    return pathname.startsWith("/dormspaces/dashboard");
  }
  if (item.key === "inquiries" || item.key === "profile" || item.key === "browse") {
    return false;
  }
  if (item.key === "browse" && pathname === "/dormspaces") return true;
  if (item.key === "list") {
    return pathname === "/dormspaces/welcome" || pathname.startsWith("/dormspaces/submit");
  }
  if (item.href && !item.scrollToListings) {
    const base = item.href.split("?")[0];
    return pathname === base;
  }
  return false;
}

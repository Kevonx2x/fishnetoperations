import type { LucideIcon } from "lucide-react";
import { Heart, Home, MessageSquare, Search, User } from "lucide-react";

/** Anchor id on homepage hero search card. */
export const BAHAYGO_HERO_SEARCH_ID = "bahaygo-hero-search";

export type MarketplaceBottomNavTabId =
  | "home"
  | "search"
  | "saved"
  | "messages"
  | "profile";

export type MarketplaceBottomNavTab = {
  id: MarketplaceBottomNavTabId;
  label: string;
  href: string;
  Icon: LucideIcon;
};

export const MARKETPLACE_BOTTOM_NAV_TABS: MarketplaceBottomNavTab[] = [
  { id: "home", label: "Home", href: "/", Icon: Home },
  { id: "search", label: "Search", href: `/#${BAHAYGO_HERO_SEARCH_ID}`, Icon: Search },
  { id: "saved", label: "Saved", href: "/saved", Icon: Heart },
  { id: "messages", label: "Messages", href: "/dashboard/client/messages", Icon: MessageSquare },
  { id: "profile", label: "Profile", href: "/profile", Icon: User },
];

export function pathForMessagesNav(
  role: string | null | undefined,
  signedIn: boolean,
): string {
  if (!signedIn) {
    return "/auth/login?next=/dashboard/client/messages";
  }
  if (role === "agent" || role === "team_member") {
    return "/dashboard/agent?tab=messages";
  }
  return "/dashboard/client/messages";
}

export function resolveMarketplaceBottomNavTabs(
  role: string | null | undefined,
  signedIn: boolean,
): MarketplaceBottomNavTab[] {
  return MARKETPLACE_BOTTOM_NAV_TABS.map((tab) => {
    if (tab.id === "messages") {
      return { ...tab, href: pathForMessagesNav(role, signedIn) };
    }
    if (tab.id === "profile") {
      return {
        ...tab,
        label: signedIn ? "Profile" : "Sign In",
        href: signedIn ? "/profile" : "/auth/login?next=/profile",
      };
    }
    return tab;
  });
}

import type { LucideIcon } from "lucide-react";
import { Heart, Home, MessageSquare, Search, User } from "lucide-react";
import { AGENT_MESSENGER_TAB_PATH } from "@/lib/agent-messages-path";
import { CLIENT_MESSENGER_PATH } from "@/lib/messenger/client-messages-path";

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

function isAgentRole(role: string | null | undefined): boolean {
  return role === "agent" || role === "broker" || role === "team_member";
}

export function pathForMessagesNav(
  role: string | null | undefined,
  signedIn: boolean,
  authLoading = false,
): string {
  if (authLoading) {
    if (isAgentRole(role)) {
      return AGENT_MESSENGER_TAB_PATH;
    }
    return CLIENT_MESSENGER_PATH;
  }
  if (!signedIn) {
    return `/auth/login?next=${encodeURIComponent("/messages")}`;
  }
  if (isAgentRole(role)) {
    return AGENT_MESSENGER_TAB_PATH;
  }
  return CLIENT_MESSENGER_PATH;
}

export function resolveMarketplaceBottomNavTabs(
  role: string | null | undefined,
  signedIn: boolean,
  authLoading = false,
): MarketplaceBottomNavTab[] {
  return MARKETPLACE_BOTTOM_NAV_TABS.map((tab) => {
    if (tab.id === "messages") {
      return { ...tab, href: pathForMessagesNav(role, signedIn, authLoading) };
    }
    if (tab.id === "profile") {
      return {
        ...tab,
        label: signedIn ? "Profile" : "Sign In",
        href: authLoading
          ? "/profile"
          : signedIn
            ? "/profile"
            : "/auth/login?next=/profile",
      };
    }
    return tab;
  });
}

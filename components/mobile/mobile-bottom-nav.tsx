"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  Bed,
  Building2,
  Columns3,
  Heart,
  Home,
  Inbox,
  Map,
  MessageSquare,
  MoreHorizontal,
  Search,
  User,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useUnreadMessageCount } from "@/features/messaging/hooks/use-unread-message-count";
import { isPublicDormspaceMarketplacePath } from "@/lib/dormspace-portal-chrome";
import { cn } from "@/lib/utils";

export type MobileBottomNavTabConfig = {
  id: string;
  label: string;
  href: string;
  Icon: LucideIcon;
  badgeCount?: number;
};

const HIDDEN_PATH_PREFIXES = ["/auth", "/admin"] as const;
const HIDDEN_PATHS = ["/dormspaces/welcome", "/dormspaces/submit"] as const;

function isMobileBottomNavHidden(pathname: string): boolean {
  if (HIDDEN_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (pathname.startsWith("/messages/")) return true;
  if (pathname === "/properties/submit" || pathname.startsWith("/properties/submit/")) return true;
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return true;
  return false;
}

/** Public marketplace — Home → Search → Saved → Inbox → More. */
const MARKETPLACE_TABS: MobileBottomNavTabConfig[] = [
  { id: "home", label: "Home", href: "/", Icon: Home },
  { id: "search", label: "Search", href: "/search", Icon: Map },
  { id: "saved", label: "Saved", href: "/saved", Icon: Heart },
  { id: "inbox", label: "Inbox", href: "/messages", Icon: MessageSquare },
  { id: "more", label: "More", href: "/more", Icon: MoreHorizontal },
];

const MARKETPLACE_TAB_IDS = new Set(MARKETPLACE_TABS.map((tab) => tab.id));

const AGENT_TABS: MobileBottomNavTabConfig[] = [
  { id: "pipeline", label: "Pipeline", href: "/dashboard/agent?tab=pipeline", Icon: Columns3 },
  { id: "listings", label: "Listings", href: "/dashboard/agent?tab=listings", Icon: Building2 },
  { id: "inquiries", label: "Inquiries", href: "/dashboard/agent?tab=inquiries", Icon: Inbox },
  { id: "profile", label: "Profile", href: "/dashboard/agent?tab=profile", Icon: User },
];

const LANDLORD_TABS: MobileBottomNavTabConfig[] = [
  { id: "listings", label: "Listings", href: "/dormspaces/dashboard?tab=listings", Icon: Bed },
  { id: "inquiries", label: "Inquiries", href: "/dormspaces/dashboard?tab=inquiries", Icon: Inbox },
  { id: "browse", label: "Browse", href: "/dormspaces", Icon: Search },
  { id: "profile", label: "Profile", href: "/dormspaces/dashboard?tab=profile", Icon: User },
];

function parseHref(href: string): { path: string; tab: string | null } {
  const [path, query] = href.split("?");
  const tab = query ? new URLSearchParams(query).get("tab") : null;
  return { path, tab };
}

function resolveMarketplaceTabs(pathname: string): MobileBottomNavTabConfig[] {
  const homeHref = isPublicDormspaceMarketplacePath(pathname) ? "/dormspaces" : "/";
  return MARKETPLACE_TABS.map((tab) =>
    tab.id === "home" ? { ...tab, href: homeHref } : tab,
  );
}

function isMarketplaceTabActive(tabId: string, pathname: string): boolean {
  const dormspacesBrowse = isPublicDormspaceMarketplacePath(pathname);

  if (tabId === "more") {
    return (
      pathname.startsWith("/more") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/dashboard/client")
    );
  }

  if (tabId === "inbox") {
    return pathname.startsWith("/messages");
  }

  if (tabId === "saved") {
    return pathname === "/saved" || pathname.startsWith("/saved/") || pathname === "/likes";
  }

  if (tabId === "search") {
    return pathname.startsWith("/search");
  }

  if (tabId === "home") {
    if (pathname.startsWith("/search")) return false;
    if (pathname === "/saved" || pathname.startsWith("/saved/") || pathname === "/likes") return false;
    if (pathname.startsWith("/messages")) return false;
    if (pathname.startsWith("/more")) return false;
    if (pathname.startsWith("/settings") || pathname.startsWith("/profile")) return false;
    if (pathname.startsWith("/dashboard")) return false;
    if (dormspacesBrowse) return true;
    if (pathname === "/") return true;
    if (pathname.startsWith("/properties")) return true;
    if (pathname.startsWith("/agents")) return true;
    return true;
  }

  return false;
}

function isTabActive(
  tab: MobileBottomNavTabConfig,
  pathname: string,
  searchTab: string | null,
): boolean {
  if (MARKETPLACE_TAB_IDS.has(tab.id)) {
    return isMarketplaceTabActive(tab.id, pathname);
  }

  const { path, tab: hrefTab } = parseHref(tab.href);

  if (tab.id === "listings" && path === "/dormspaces/dashboard") {
    if (!pathname.startsWith("/dormspaces/dashboard")) return false;
    const effectiveTab = searchTab ?? "listings";
    return effectiveTab === "listings";
  }

  if (path === "/dashboard/agent") {
    if (
      !pathname.startsWith("/dashboard/agent") &&
      !pathname.startsWith("/dashboard/broker")
    ) {
      return false;
    }
    if (!hrefTab) return false;
    if (hrefTab === "pipeline") return searchTab === "pipeline";
    if (hrefTab === "listings") return searchTab === "listings";
    if (hrefTab === "inquiries") return searchTab === "inquiries";
    if (hrefTab === "profile") return searchTab === "profile";
    return searchTab === hrefTab;
  }

  if (path === "/dormspaces/dashboard") {
    if (!pathname.startsWith("/dormspaces/dashboard")) return false;
    const effectiveTab = searchTab ?? "listings";
    if (hrefTab === "listings") return effectiveTab === "listings";
    if (hrefTab === "inquiries") return effectiveTab === "inquiries";
    if (hrefTab === "profile") return effectiveTab === "profile";
    return effectiveTab === hrefTab;
  }

  return pathname === path || pathname.startsWith(`${path}/`);
}

function resolveTabs(pathname: string | null | undefined): MobileBottomNavTabConfig[] {
  const path = pathname?.trim() || "/";

  if (path.startsWith("/dashboard/agent") || path.startsWith("/dashboard/broker")) {
    return AGENT_TABS;
  }

  if (path.startsWith("/dormspaces/dashboard")) {
    return LANDLORD_TABS;
  }

  return resolveMarketplaceTabs(path);
}

function formatBadge(count: number): string {
  if (count > 9) return "9+";
  return String(count);
}

function NavTab({
  tab,
  active,
}: {
  tab: MobileBottomNavTabConfig;
  active: boolean;
}) {
  const { Icon, label, href, badgeCount } = tab;
  const showBadge = badgeCount != null && badgeCount > 0;

  return (
    <Link
      href={href}
      className={cn(
        "relative flex min-h-[44px] min-w-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0",
        active ? "text-[#6B9E6E]" : "text-[#888888]",
      )}
      aria-current={active ? "page" : undefined}
    >
      {active ? (
        <span className="absolute inset-x-0 top-0 h-0.5 bg-[#6B9E6E]" aria-hidden />
      ) : null}
      <span className="relative flex h-6 w-6 items-center justify-center">
        <Icon
          className={cn("h-6 w-6 shrink-0", active ? "text-[#6B9E6E]" : "text-[#888888]")}
          strokeWidth={active ? 2.25 : 2}
          aria-hidden
        />
        {showBadge ? (
          <span className="pointer-events-none absolute -right-1.5 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {formatBadge(badgeCount!)}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "max-w-[4.5rem] truncate text-center text-[10px] uppercase tracking-tight",
          active ? "font-semibold text-[#6B9E6E]" : "font-medium text-[#888888]",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchTab = searchParams.get("tab");
  const { user, profile } = useAuth();
  const messagesUnread = useUnreadMessageCount();

  const path = pathname ?? "/";
  const hidden = isMobileBottomNavHidden(path);
  const tabs = useMemo(() => {
    const base = resolveTabs(pathname ?? "/");
    return base.map((t) =>
      t.id === "inbox" && messagesUnread > 0
        ? { ...t, badgeCount: messagesUnread }
        : t,
    );
  }, [pathname, messagesUnread]);

  if (hidden) {
    return null;
  }

  return (
    // TODO: Stray "N" circle on Explore tab in dev is likely the Next.js dev indicator overlay, not this nav.
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/[0.06] bg-white py-2 md:hidden pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch px-0">
        {tabs.map((tab) => (
          <NavTab key={tab.id} tab={tab} active={isTabActive(tab, path, searchTab)} />
        ))}
      </div>
    </nav>
  );
}

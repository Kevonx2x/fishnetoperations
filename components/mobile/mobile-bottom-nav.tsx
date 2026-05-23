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
  Search,
  User,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { isLandlordCapable } from "@/lib/auth-roles";
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
  return false;
}

/** Public marketplace (/, /properties/*, /saved, etc.) — same for all roles. */
const MARKETPLACE_TABS: MobileBottomNavTabConfig[] = [
  { id: "explore", label: "Explore", href: "/", Icon: Home },
  { id: "saved", label: "Saved", href: "/saved", Icon: Heart },
  { id: "dormspaces", label: "Dormspaces", href: "/dormspaces", Icon: Bed },
  { id: "profile", label: "Profile", href: "/profile", Icon: User },
];

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

function isDormspacesBrowsePath(pathname: string): boolean {
  if (pathname === "/dormspaces") return true;
  if (!pathname.startsWith("/dormspaces/")) return false;
  if (pathname.startsWith("/dormspaces/dashboard")) return false;
  if (pathname.startsWith("/dormspaces/welcome")) return false;
  if (pathname.startsWith("/dormspaces/submit")) return false;
  return true;
}

function isTabActive(
  tab: MobileBottomNavTabConfig,
  pathname: string,
  searchTab: string | null,
): boolean {
  const { path, tab: hrefTab } = parseHref(tab.href);

  if (path === "/") {
    return pathname === "/";
  }

  if (path === "/saved") {
    return pathname === "/saved" || pathname.startsWith("/saved/");
  }

  if (path === "/dormspaces" && tab.id === "dormspaces") {
    return isDormspacesBrowsePath(pathname);
  }

  if (path === "/profile" || tab.id === "profile") {
    return pathname === "/profile" || pathname === "/settings" || pathname.startsWith("/settings/");
  }

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

  if (path === "/dormspaces" && tab.id === "browse") {
    return isDormspacesBrowsePath(pathname);
  }

  return pathname === path || pathname.startsWith(`${path}/`);
}

function resolveTabs(
  pathname: string | null | undefined,
  isSignedIn: boolean,
  isLandlordCapableUser: boolean,
): MobileBottomNavTabConfig[] {
  const path = pathname?.trim() || "/";

  if (path.startsWith("/dashboard/agent") || path.startsWith("/dashboard/broker")) {
    return AGENT_TABS;
  }

  if (path.startsWith("/dormspaces/dashboard")) {
    return LANDLORD_TABS;
  }

  if (path.startsWith("/dormspaces")) {
    return [
      { id: "browse", label: "Browse", href: "/dormspaces", Icon: Search },
      isLandlordCapableUser
        ? {
            id: "listings",
            label: "My Listings",
            href: "/dormspaces/dashboard?tab=listings",
            Icon: Bed,
          }
        : { id: "saved", label: "Saved", href: "/saved", Icon: Heart },
      {
        id: "profile",
        label: isSignedIn ? "Profile" : "Sign In",
        href: isSignedIn ? "/profile" : "/auth/login?next=/profile",
        Icon: User,
      },
    ];
  }

  return MARKETPLACE_TABS.map((t) => {
    if (t.id === "profile") {
      return {
        ...t,
        label: isSignedIn ? "Profile" : "Sign In",
        href: isSignedIn ? "/profile" : "/auth/login?next=/profile",
      };
    }
    return t;
  });
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
        "relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1.5",
        active ? "text-[#6B9E6E]" : "text-[#888888]",
      )}
      aria-current={active ? "page" : undefined}
    >
      {active ? (
        <span
          className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#6B9E6E]"
          aria-hidden
        />
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
          "max-w-[4.5rem] truncate text-center text-[10px] uppercase tracking-wide",
          active ? "font-semibold text-[#6B9E6E]" : "font-semibold text-[#888888]",
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

  const path = pathname ?? "/";
  const hidden = isMobileBottomNavHidden(path);
  const isLandlordCapableUser = isLandlordCapable(profile);

  const tabs = useMemo(
    () => resolveTabs(pathname ?? "/", Boolean(user), isLandlordCapableUser),
    [pathname, user, isLandlordCapableUser],
  );

  if (hidden) {
    return null;
  }

  return (
    // TODO: Stray "N" circle on Explore tab in dev is likely the Next.js dev indicator overlay, not this nav.
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#DDDDDD] bg-white pt-2 shadow-[0_-2px_8px_rgba(0,0,0,0.04)] md:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex h-[60px] max-w-lg items-stretch justify-between px-1">
        {tabs.map((tab) => (
          <NavTab key={tab.id} tab={tab} active={isTabActive(tab, path, searchTab)} />
        ))}
      </div>
    </nav>
  );
}

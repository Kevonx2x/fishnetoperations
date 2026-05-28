"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useSoftKeyboardOpen } from "@/hooks/use-soft-keyboard-open";
import { isMessagesThreadOpen } from "@/lib/messages-mobile-chrome";
import {
  Activity,
  Heart,
  Home,
  Map,
  MessageSquare,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AGENT_MOBILE_PIPELINE_PATH } from "@/lib/agent-dashboard-routes";
import {
  MobileNavAnimatedIcon,
  type MobileNavIconId,
} from "@/components/mobile/mobile-nav-animated-icon";
import { isDormspaceDashboardPath } from "@/lib/dormspace-portal-chrome";
import { useUnreadMessageCount } from "@/features/messaging/hooks/use-unread-message-count";
import { isPublicDormspaceMarketplacePath } from "@/lib/dormspace-portal-chrome";
import { useMobileChromeOverlay } from "@/contexts/mobile-chrome-context";
import { cn } from "@/lib/utils";

export type MobileBottomNavTabConfig = {
  id: string;
  label: string;
  href: string;
  Icon: LucideIcon;
  badgeCount?: number;
};

const HIDDEN_PATH_PREFIXES = ["/auth", "/admin"] as const;
const HIDDEN_PATHS = ["/dormspaces/submit", "/dormspaces/welcome"] as const;

function isMobileBottomNavHidden(
  pathname: string,
  hasActiveChannel: boolean,
  keyboardOpenOnMessagesThread: boolean,
): boolean {
  if (HIDDEN_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (pathname.startsWith("/messages/")) return true;
  if (pathname === "/messages" && hasActiveChannel) return true;
  if (keyboardOpenOnMessagesThread) return true;
  if (pathname === "/properties/submit" || pathname.startsWith("/properties/submit/")) return true;
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return true;
  return false;
}

/** Public marketplace — Home → Search → Saved → Inbox → More. */
const MARKETPLACE_TABS: MobileBottomNavTabConfig[] = [
  { id: "home", label: "Home", href: "/", Icon: Home },
  { id: "search", label: "Search", href: "/search", Icon: Map },
  { id: "saved", label: "Saved", href: "/saved", Icon: Heart },
  { id: "inbox", label: "Messages", href: "/messages", Icon: MessageSquare },
  { id: "more", label: "More", href: "/more", Icon: MoreHorizontal },
];

/** Agent/broker mobile nav — Saved becomes Leads (pipeline). */
const AGENT_LEADS_TAB: MobileBottomNavTabConfig = {
  id: "leads",
  label: "Leads",
  href: AGENT_MOBILE_PIPELINE_PATH,
  Icon: Activity,
};

const MARKETPLACE_TAB_IDS = new Set(MARKETPLACE_TABS.map((tab) => tab.id));
const AGENT_LEADS_TAB_IDS = new Set([...MARKETPLACE_TAB_IDS, AGENT_LEADS_TAB.id]);

function isAgentBrokerNavRole(role: string | null | undefined): boolean {
  return role === "agent" || role === "broker";
}

function isAgentLeadsPathActive(pathname: string, searchParams: URLSearchParams | null): boolean {
  if (pathname === AGENT_MOBILE_PIPELINE_PATH || pathname.startsWith(`${AGENT_MOBILE_PIPELINE_PATH}/`)) {
    return true;
  }
  if (pathname === "/dashboard/agent" || pathname.startsWith("/dashboard/agent/")) {
    const tab = searchParams?.get("tab");
    return tab === "pipeline" || tab === "leads" || tab === "viewings";
  }
  return false;
}

/** Public dormspaces marketplace — no Inbox; More stays in-product. */
const DORMSPACES_PUBLIC_TABS: MobileBottomNavTabConfig[] = [
  { id: "home", label: "Home", href: "/dormspaces", Icon: Home },
  { id: "search", label: "Search", href: "/dormspaces/search", Icon: Map },
  { id: "saved", label: "Saved", href: "/dormspaces/liked", Icon: Heart },
  { id: "more", label: "More", href: "/dormspaces/more", Icon: MoreHorizontal },
];

const DORMSPACES_PUBLIC_TAB_IDS = new Set(DORMSPACES_PUBLIC_TABS.map((tab) => tab.id));

function usesDormspacesPublicBottomNav(pathname: string): boolean {
  return isPublicDormspaceMarketplacePath(pathname) || isDormspaceDashboardPath(pathname);
}

function isDormspacesHomeActive(pathname: string): boolean {
  if (!pathname.startsWith("/dormspaces")) return false;
  if (pathname.startsWith("/dormspaces/dashboard")) return false;
  if (pathname === "/dormspaces/submit" || pathname.startsWith("/dormspaces/submit/")) return false;
  if (pathname.startsWith("/dormspaces/more")) return false;
  if (pathname.startsWith("/dormspaces/search")) return false;
  if (pathname.startsWith("/dormspaces/liked")) return false;
  return true;
}

function isDormspacesPublicTabActive(tabId: string, pathname: string): boolean {
  if (tabId === "home") return isDormspacesHomeActive(pathname);
  if (tabId === "search") return pathname.startsWith("/dormspaces/search");
  if (tabId === "saved") {
    return pathname.startsWith("/dormspaces/liked");
  }
  if (tabId === "more") {
    return pathname.startsWith("/dormspaces/more") || pathname.startsWith("/dormspaces/dashboard");
  }
  return false;
}

function isMarketplaceTabActive(
  tabId: string,
  pathname: string,
  searchParams: URLSearchParams | null,
): boolean {
  if (tabId === "more") {
    if (isAgentLeadsPathActive(pathname, searchParams)) return false;
    return (
      pathname.startsWith("/more") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/dashboard/client") ||
      pathname.startsWith("/dashboard/agent")
    );
  }

  if (tabId === "inbox") {
    return pathname.startsWith("/messages");
  }

  if (tabId === "leads") {
    return isAgentLeadsPathActive(pathname, searchParams);
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
    if (isAgentLeadsPathActive(pathname, searchParams)) return false;
    if (pathname.startsWith("/messages")) return false;
    if (pathname.startsWith("/more")) return false;
    if (pathname.startsWith("/settings") || pathname.startsWith("/profile")) return false;
    if (pathname.startsWith("/dashboard")) return false;
    if (pathname.startsWith("/dormspaces")) return false;
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
  searchParams: URLSearchParams | null,
): boolean {
  if (DORMSPACES_PUBLIC_TAB_IDS.has(tab.id) && usesDormspacesPublicBottomNav(pathname)) {
    return isDormspacesPublicTabActive(tab.id, pathname);
  }

  if (AGENT_LEADS_TAB_IDS.has(tab.id)) {
    return isMarketplaceTabActive(tab.id, pathname, searchParams);
  }

  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

function resolveTabs(
  pathname: string | null | undefined,
  role: string | null | undefined,
): MobileBottomNavTabConfig[] {
  const path = pathname?.trim() || "/";

  if (usesDormspacesPublicBottomNav(path)) {
    return DORMSPACES_PUBLIC_TABS;
  }

  if (isAgentBrokerNavRole(role)) {
    return MARKETPLACE_TABS.map((t) => (t.id === "saved" ? AGENT_LEADS_TAB : t));
  }

  return MARKETPLACE_TABS;
}

function formatBadge(count: number): string {
  if (count > 9) return "9+";
  return String(count);
}

function navIconId(tabId: string): MobileNavIconId {
  if (tabId === "inbox") return "inbox";
  if (tabId === "search") return "search";
  if (tabId === "saved") return "saved";
  if (tabId === "leads") return "activity";
  if (tabId === "more") return "more";
  return "home";
}

function NavTab({
  tab,
  active,
  onNavigate,
}: {
  tab: MobileBottomNavTabConfig;
  active: boolean;
  onNavigate: (href: string) => void;
}) {
  const { Icon, label, href, badgeCount } = tab;
  const showBadge = badgeCount != null && badgeCount > 0;

  return (
    <Link
      href={href}
      prefetch
      scroll
      onClick={(e) => {
        e.preventDefault();
        if (active) {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        onNavigate(href);
      }}
      className={cn(
        "relative z-10 flex min-h-[44px] min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 px-0",
        active ? "text-[#6B9E6E]" : "text-[#717171]",
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="relative flex h-7 w-7 items-center justify-center">
        <MobileNavAnimatedIcon id={navIconId(tab.id)} Icon={Icon} active={active} size={24} />
        {showBadge ? (
          <span className="pointer-events-none absolute -right-1 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {formatBadge(badgeCount!)}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "max-w-[4.5rem] truncate text-center text-[10px] tracking-tight",
          active ? "font-semibold text-[#6B9E6E]" : "font-medium text-[#717171]",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role } = useAuth();
  const messagesUnread = useUnreadMessageCount();
  const { overlayOpen } = useMobileChromeOverlay();

  const path = pathname ?? "/";
  const channelParam = searchParams.get("channel");
  const messagesThreadOpen = isMessagesThreadOpen(path, channelParam);
  const keyboardOpen = useSoftKeyboardOpen();
  const keyboardOnMessagesThread = keyboardOpen && messagesThreadOpen;
  const hidden =
    overlayOpen || isMobileBottomNavHidden(path, messagesThreadOpen, keyboardOnMessagesThread);
  const tabs = useMemo(() => {
    const base = resolveTabs(pathname ?? "/", role);
    return base.map((t) =>
      t.id === "inbox" && messagesUnread > 0
        ? { ...t, badgeCount: messagesUnread }
        : t,
    );
  }, [pathname, role, messagesUnread]);

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
          <NavTab
            key={tab.id}
            tab={tab}
            active={isTabActive(tab, path, searchParams)}
            onNavigate={(href) => router.push(href)}
          />
        ))}
      </div>
    </nav>
  );
}

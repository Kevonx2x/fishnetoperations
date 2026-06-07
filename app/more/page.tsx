"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, type ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Clock,
  CreditCard,
  Flag,
  Heart,
  HelpCircle,
  Info,
  LayoutList,
  LogOut,
  Mail,
  Map,
  Plus,
  Settings,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AGENT_MORE_TAB_PATHS } from "@/lib/agent-dashboard-routes";
import { useAuth } from "@/contexts/auth-context";
import { DormspaceBrandIcon } from "@/components/dormspaces/dormspace-welcome-logo";
import {
  MobileMoreSectionedGrid,
  type MobileMoreGridSection,
} from "@/components/mobile/mobile-more-sectioned-grid";
import { supabase } from "@/lib/supabase";

/** Routes verified against the app directory — hide rows when false. */
const ROUTES = {
  dormspaces: true,
  dormspacesWelcome: true,
  search: false,
  agents: true,
  pipeline: true,
  saved: true,
  recentlyViewed: false,
  agentDashboard: true,
  agentSignup: true,
  propertiesSubmit: false,
  faq: true,
  about: true,
  settings: true,
  authLogin: true,
} as const;

const PATHS = {
  dormspaces: "/dormspaces",
  dormspacesWelcome: "/dormspaces/welcome",
  search: "/search",
  agents: "/agents",
  pipeline: "/dashboard/client/pipeline",
  saved: "/saved",
  recentlyViewed: "/recently-viewed",
  agentDashboard: "/dashboard/agent",
  agentSignup: "/register/agent",
  propertiesSubmit: "/properties/submit",
  faq: "/faq",
  about: "/about",
  settings: "/settings",
  authLogin: "/auth/login?next=/more",
} as const;

type MenuItem = {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  iconMarkup?: ReactNode;
  href?: string;
  badge?: string;
  badgeGold?: boolean;
  primaryAccent?: boolean;
  destructive?: boolean;
  onClick?: () => void;
};

type MenuSection = {
  id: string;
  title: string;
  featuredItem?: MenuItem;
  items: MenuItem[];
};

function profileInitials(name: string | null | undefined, email: string | null | undefined): string {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

export default function MorePage() {
  const router = useRouter();
  const { user, profile, role, loading, status } = useAuth();

  const isSignedIn = status === "authenticated" && Boolean(user);
  const isAgentUser = role === "agent" || role === "broker";

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }, [router]);

  const sections = useMemo((): MenuSection[] => {
    const dormspacersFeatured: MenuItem | undefined = ROUTES.dormspacesWelcome
      ? {
          id: "dormspaces",
          label: "Dormspacers",
          iconMarkup: <DormspaceBrandIcon className="h-5 w-5" />,
          href: PATHS.dormspacesWelcome,
          badge: "NEW",
          badgeGold: true,
        }
      : undefined;

    const discoverItems: MenuItem[] = [];
    if (ROUTES.search) {
      discoverItems.push({
        id: "browse-map",
        label: "Browse by map",
        description: "Search listings across the metro",
        icon: Map,
        href: PATHS.search,
      });
    }
    if (ROUTES.agents) {
      discoverItems.push({
        id: "featured-agents",
        label: "Featured agents",
        description: "Meet verified BahayGo agents near you",
        icon: Users,
        href: PATHS.agents,
      });
    }

    const activityItems: MenuItem[] = [];
    if (isSignedIn) {
      if (ROUTES.pipeline && !isAgentUser) {
        activityItems.push({
          id: "pipeline",
          label: "Pipeline",
          description: "Track homes and viewings you're pursuing",
          icon: Activity,
          href: PATHS.pipeline,
        });
      }
      if (ROUTES.saved && !isAgentUser) {
        activityItems.push({
          id: "saved",
          label: "Saved listings",
          description: "Properties and dormspaces you've saved",
          icon: Heart,
          href: PATHS.saved,
        });
      }
      if (ROUTES.recentlyViewed) {
        activityItems.push({
          id: "recently-viewed",
          label: "Recently viewed",
          description: "Pick up where you left off",
          icon: Clock,
          href: PATHS.recentlyViewed,
        });
      }
    }

    const agentItems: MenuItem[] = [];
    if (isAgentUser && ROUTES.agentDashboard) {
      agentItems.push(
        {
          id: "agent-listings",
          label: "My Listings",
          description: "Manage your active property listings",
          icon: LayoutList,
          href: AGENT_MORE_TAB_PATHS.listings,
        },
        {
          id: "agent-analytics",
          label: "Analytics",
          description: "Views, leads, and performance",
          icon: BarChart3,
          href: AGENT_MORE_TAB_PATHS.analytics,
        },
        {
          id: "agent-billing",
          label: "Billing",
          description: "Subscription and payments",
          icon: CreditCard,
          href: AGENT_MORE_TAB_PATHS.billing,
        },
        {
          id: "agent-profile",
          label: "My Profile",
          description: "Your public agent profile",
          icon: UserCircle,
          href: AGENT_MORE_TAB_PATHS.profile,
        },
      );
    } else if (!isAgentUser && ROUTES.agentSignup) {
      agentItems.push({
        id: "become-agent",
        label: "Become a verified agent",
        description: "List properties and grow your book of business",
        icon: BadgeCheck,
        href: PATHS.agentSignup,
      });
    }
    if (isAgentUser && ROUTES.propertiesSubmit) {
      agentItems.push({
        id: "list-property",
        label: "List a property",
        description: "Publish a new BahayGo listing",
        icon: Plus,
        href: PATHS.propertiesSubmit,
      });
    }

    const helpItems: MenuItem[] = [
      ...(ROUTES.faq
        ? [
            {
              id: "faq",
              label: "FAQ",
              description: "Answers to common questions",
              icon: HelpCircle,
              href: PATHS.faq,
            },
          ]
        : []),
      ...(ROUTES.about
        ? [
            {
              id: "about",
              label: "About BahayGo",
              description: "Our story and how we help you find home",
              icon: Info,
              href: PATHS.about,
            },
          ]
        : []),
      {
        id: "contact",
        label: "Contact support",
        description: "We're here if you need a hand",
        icon: Mail,
        href: "mailto:support@bahaygo.com",
      },
      {
        id: "report",
        label: "Report an issue",
        description: "Tell us what went wrong",
        icon: Flag,
        href: "mailto:support@bahaygo.com?subject=Issue%20Report",
      },
    ];

    const accountItems: MenuItem[] = [];
    if (isSignedIn) {
      if (ROUTES.settings) {
        accountItems.push({
          id: "settings",
          label: "Settings",
          description: "Account, notifications, and preferences",
          icon: Settings,
          href: PATHS.settings,
        });
      }
      accountItems.push({
        id: "sign-out",
        label: "Sign out",
        icon: LogOut,
        destructive: true,
        onClick: () => void handleSignOut(),
      });
    }

    const result: MenuSection[] = [];
    if (dormspacersFeatured || discoverItems.length > 0) {
      result.push({
        id: "discover",
        title: "Discover",
        featuredItem: dormspacersFeatured,
        items: discoverItems,
      });
    }
    if (activityItems.length > 0) {
      result.push({ id: "activity", title: "Your activity", items: activityItems });
    }
    if (agentItems.length > 0) {
      result.push({ id: "agents", title: "For agents", items: agentItems });
    }
    if (helpItems.length > 0) {
      result.push({ id: "help", title: "Help and information", items: helpItems });
    }
    if (accountItems.length > 0) {
      result.push({ id: "account", title: "Account", items: accountItems });
    }
    return result;
  }, [handleSignOut, isAgentUser, isSignedIn]);

  const displayName = profile?.full_name?.trim() || "Your account";
  const email = user?.email ?? "";

  const mobileSections = useMemo(
    (): MobileMoreGridSection[] =>
      sections.map((section) => ({
        id: section.id,
        title: section.title,
        featuredItem: section.featuredItem
          ? {
              id: section.featuredItem.id,
              label: section.featuredItem.label,
              description: section.featuredItem.description,
              icon: section.featuredItem.icon,
              iconMarkup: section.featuredItem.iconMarkup,
              href: section.featuredItem.href,
              onClick: section.featuredItem.onClick,
              destructive: section.featuredItem.destructive,
              badge: section.featuredItem.badge,
              badgeGold: section.featuredItem.badgeGold,
            }
          : undefined,
        items: section.items.map((item) => ({
          id: item.id,
          label: item.label,
          icon: item.icon,
          iconMarkup: item.iconMarkup,
          href: item.href,
          onClick: item.onClick,
          destructive: item.destructive,
          badge: item.badge,
          badgeGold: item.badgeGold,
        })),
      })),
    [sections],
  );

  return (
    <MobileMoreSectionedGrid
      sections={mobileSections}
      loading={loading}
      signedIn={isSignedIn}
      signInHref={PATHS.authLogin}
      profileHref={PATHS.settings}
      profileName={displayName}
      profileEmail={email}
      profileAvatarUrl={profile?.avatar_url}
      profileInitials={profileInitials(profile?.full_name, email)}
      showFooter
    />
  );
}

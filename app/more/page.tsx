"use client";

import Link from "next/link";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, type ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  ChevronRight,
  Clock,
  Flag,
  Heart,
  HelpCircle,
  Info,
  LayoutDashboard,
  LogOut,
  Mail,
  Map,
  Plus,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AuthSignInLinkForPath } from "@/components/auth/auth-sign-in-cta";
import { DormspaceBrandIcon } from "@/components/dormspaces/dormspace-welcome-logo";
import {
  MobileMoreSectionedGrid,
  type MobileMoreGridSection,
} from "@/components/mobile/mobile-more-sectioned-grid";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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

function MenuRow({
  item,
  showDivider,
}: {
  item: MenuItem;
  showDivider?: boolean;
}) {
  const iconClass = item.destructive ? "text-red-500" : "text-[#6B9E6E]";

  const inner = (
    <>
      <span className="flex w-[22px] shrink-0 items-center justify-center">
        {item.iconMarkup ??
          (item.icon ? (
            <item.icon className={cn("h-[22px] w-[22px]", iconClass)} strokeWidth={1.5} aria-hidden />
          ) : null)}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[15px] font-medium leading-tight",
            item.destructive ? "text-red-500" : "text-[#2C2C2C]",
          )}
        >
          {item.label}
        </p>
        {item.description ? (
          <p className="mt-0.5 truncate text-[13px] font-normal leading-tight text-[#888888]">
            {item.description}
          </p>
        ) : null}
      </div>
      {item.badge ? (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            item.badgeGold ? "bg-[#D4A843] text-white" : "bg-[#6B9E6E]/10 text-[#6B9E6E]",
          )}
        >
          {item.badge}
        </span>
      ) : null}
      {!item.destructive ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-[#BBBBBB]" aria-hidden />
      ) : null}
    </>
  );

  const rowClass = cn(
    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
    "hover:bg-black/[0.02] active:bg-black/[0.04]",
    item.primaryAccent && "border-l-[3px] border-l-[#6B9E6E] pl-[13px]",
    showDivider && "border-t border-black/[0.06]",
  );

  if (item.onClick) {
    return (
      <button type="button" onClick={item.onClick} className={rowClass}>
        {inner}
      </button>
    );
  }

  if (item.href?.startsWith("mailto:")) {
    return (
      <a href={item.href} className={rowClass}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={item.href ?? "/"} className={rowClass}>
      {inner}
    </Link>
  );
}

function MenuSectionBlock({ section, isFirst }: { section: MenuSection; isFirst?: boolean }) {
  if (section.items.length === 0) return null;

  return (
    <section className={cn(isFirst ? "mt-6" : "mt-8")}>
      <h2
        className="mb-2 px-4 text-xs font-medium uppercase tracking-wider text-[#888888]"
        style={{ letterSpacing: "0.08em" }}
      >
        {section.title}
      </h2>
      <div className="mx-4 overflow-hidden rounded-xl border border-black/[0.06] bg-white">
        {section.items.map((item, index) => (
          <MenuRow key={item.id} item={item} showDivider={index > 0} />
        ))}
      </div>
    </section>
  );
}

export default function MorePage() {
  const router = useRouter();
  const { user, profile, role, loading } = useAuth();

  const isSignedIn = Boolean(user);
  const isAgentUser = role === "agent" || role === "broker";

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }, [router]);

  const sections = useMemo((): MenuSection[] => {
    const discoverItems: MenuItem[] = [];
    if (ROUTES.dormspacesWelcome) {
      discoverItems.push({
        id: "dormspaces",
        label: "Dormspaces",
        description: "Find dormmates and explore student housing",
        iconMarkup: <DormspaceBrandIcon />,
        href: PATHS.dormspacesWelcome,
        badge: "NEW",
        badgeGold: true,
        primaryAccent: true,
      });
    }
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
      if (ROUTES.saved) {
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
      agentItems.push({
        id: "agent-dashboard",
        label: "Agent dashboard",
        description: "Pipeline, listings, and client conversations",
        icon: LayoutDashboard,
        href: PATHS.agentDashboard,
      });
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
    if (discoverItems.length > 0) {
      result.push({ id: "discover", title: "Discover", items: discoverItems });
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
    <>
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
      />

      <div className="hidden min-h-screen bg-[#FAF8F4] font-sans text-[#2C2C2C] md:block">
      <div className="pb-32 pt-[env(safe-area-inset-top,0px)]">
        {!loading && !isSignedIn ? (
          <header className="flex items-center justify-end px-4 pb-2 pt-4">
            <AuthSignInLinkForPath nextPath="/more" nav />
          </header>
        ) : null}

        {!loading && isSignedIn ? (
          <Link
            href={PATHS.settings}
            className="mx-4 mb-4 mt-6 flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white p-5 transition-colors hover:bg-black/[0.02] active:bg-black/[0.04]"
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#6B9E6E]">
              {profile?.avatar_url ? (
                <SupabasePublicImage
                  src={profile.avatar_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-base font-semibold text-white">
                  {profileInitials(profile?.full_name, email)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-lg font-semibold text-[#2C2C2C]">{displayName}</p>
              {email ? <p className="truncate text-[13px] font-normal text-[#888888]">{email}</p> : null}
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-[#888888]" aria-hidden />
          </Link>
        ) : null}

        {sections.map((section, index) => (
          <MenuSectionBlock
            key={section.id}
            section={section}
            isFirst={index === 0 && !loading && !isSignedIn}
          />
        ))}

        <footer className="mb-24 mt-8 px-4 text-center">
          <p className="text-xs text-[#888888]">BahayGo Realty Services</p>
          <p className="mt-1 text-xs text-[#888888]">Made in the Philippines</p>
          <p className="mt-1 text-xs text-[#888888]">v1.0</p>
        </footer>
      </div>
      </div>
    </>
  );
}

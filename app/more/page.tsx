"use client";

import Link from "next/link";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  Activity,
  BadgeCheck,
  Bed,
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
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** Routes verified against the app directory — hide rows when false. */
const ROUTES = {
  dormspaces: true,
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
  icon: LucideIcon;
  href?: string;
  badge?: string;
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

function MenuRow({ item }: { item: MenuItem }) {
  const iconClass = item.destructive ? "text-red-500" : "text-[#6B9E6E]";
  const labelClass = item.destructive ? "text-red-500" : "text-[#2C2C2C]";

  const inner = (
    <>
      <item.icon className={cn("h-5 w-5 shrink-0", iconClass)} strokeWidth={2} aria-hidden />
      <span className={cn("min-w-0 flex-1 text-[15px] font-medium", labelClass)}>{item.label}</span>
      {item.badge ? (
        <span className="rounded-full bg-[#6B9E6E]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B9E6E]">
          {item.badge}
        </span>
      ) : item.destructive ? null : (
        <ChevronRight className="h-5 w-5 shrink-0 text-[#888888]" aria-hidden />
      )}
    </>
  );

  const rowClass =
    "flex min-h-12 w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/[0.02] active:bg-black/[0.04]";

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

function MenuSectionBlock({ section }: { section: MenuSection }) {
  if (section.items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 mt-6 px-4 text-xs font-medium uppercase tracking-wide text-[#888888]">
        {section.title}
      </h2>
      <div className="mx-4 divide-y divide-black/[0.06] overflow-hidden rounded-xl border border-black/[0.06] bg-white">
        {section.items.map((item) => (
          <MenuRow key={item.id} item={item} />
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
    if (ROUTES.dormspaces) {
      discoverItems.push({
        id: "dormspaces",
        label: "Dormspaces",
        icon: Bed,
        href: PATHS.dormspaces,
        badge: "NEW",
      });
    }
    if (ROUTES.search) {
      discoverItems.push({
        id: "browse-map",
        label: "Browse by map",
        icon: Map,
        href: PATHS.search,
      });
    }
    if (ROUTES.agents) {
      discoverItems.push({
        id: "featured-agents",
        label: "Featured agents",
        icon: Users,
        href: PATHS.agents,
      });
    }

    const activityItems: MenuItem[] = [];
    if (isSignedIn) {
      if (ROUTES.pipeline) {
        activityItems.push({
          id: "pipeline",
          label: "Pipeline",
          icon: Activity,
          href: PATHS.pipeline,
        });
      }
      if (ROUTES.saved) {
        activityItems.push({
          id: "saved",
          label: "Saved listings",
          icon: Heart,
          href: PATHS.saved,
        });
      }
      if (ROUTES.recentlyViewed) {
        activityItems.push({
          id: "recently-viewed",
          label: "Recently viewed",
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
        icon: LayoutDashboard,
        href: PATHS.agentDashboard,
      });
    } else if (!isAgentUser && ROUTES.agentSignup) {
      agentItems.push({
        id: "become-agent",
        label: "Become a verified agent",
        icon: BadgeCheck,
        href: PATHS.agentSignup,
      });
    }
    if (isAgentUser && ROUTES.propertiesSubmit) {
      agentItems.push({
        id: "list-property",
        label: "List a property",
        icon: Plus,
        href: PATHS.propertiesSubmit,
      });
    }

    const helpItems: MenuItem[] = [
      ...(ROUTES.faq
        ? [{ id: "faq", label: "FAQ", icon: HelpCircle, href: PATHS.faq }]
        : []),
      ...(ROUTES.about
        ? [{ id: "about", label: "About BahayGo", icon: Info, href: PATHS.about }]
        : []),
      {
        id: "contact",
        label: "Contact support",
        icon: Mail,
        href: "mailto:support@bahaygo.com",
      },
      {
        id: "report",
        label: "Report an issue",
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

  return (
    <div className="min-h-screen bg-[#FAF8F4] font-sans text-[#2C2C2C]">
      <div className="pb-32 pt-[env(safe-area-inset-top,0px)]">
        <h1 className="px-4 pb-2 pt-6 font-serif text-[28px] font-semibold leading-tight text-[#2C2C2C]">
          More
        </h1>

        {!loading && isSignedIn ? (
          <Link
            href={PATHS.settings}
            className="mx-4 mb-4 flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white p-4 transition-colors hover:bg-black/[0.02] active:bg-black/[0.04]"
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
              <p className="truncate text-base font-semibold text-[#2C2C2C]">{displayName}</p>
              {email ? <p className="truncate text-xs text-[#888888]">{email}</p> : null}
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-[#888888]" aria-hidden />
          </Link>
        ) : null}

        {!loading && !isSignedIn ? (
          <div className="mx-4 mb-4 rounded-xl border border-black/[0.06] bg-white p-4">
            <p className="text-sm text-[#2C2C2C]/70">Access saved homes, pipeline, and account settings.</p>
            {ROUTES.authLogin ? (
              <Link
                href={PATHS.authLogin}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#6B9E6E] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#5d8a60] active:bg-[#527a55]"
              >
                Sign in or create account
              </Link>
            ) : null}
          </div>
        ) : null}

        {sections.map((section) => (
          <MenuSectionBlock key={section.id} section={section} />
        ))}

        <footer className="mb-24 mt-8 px-4 text-center">
          <p className="text-xs text-[#888888]">BahayGo Realty Services</p>
          <p className="mt-1 text-xs text-[#888888]">Made in the Philippines</p>
          <p className="mt-1 text-xs text-[#888888]">v1.0</p>
        </footer>
      </div>
    </div>
  );
}

"use client";

import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import {
  MobileMoreTruliaGrid,
  type MobileMoreGridItem,
} from "@/components/mobile/mobile-more-trulia-grid";
import Link from "next/link";
import { SupabasePublicImage } from "@/components/supabase-public-image";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  ArrowRight,
  Bed,
  ChevronRight,
  Flag,
  Heart,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Plus,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { isLandlordCapable } from "@/lib/auth-roles";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** Routes verified against the app directory — hide rows when false. */
const ROUTES = {
  dormspaces: true,
  dormspacesLiked: true,
  search: true,
  dormspacesLandlords: false,
  dormspacesDashboard: true,
  dormspacesSubmit: true,
  dormspacesWelcome: true,
  faq: true,
  settings: true,
  authLogin: true,
} as const;

const PATHS = {
  dormspaces: "/dormspaces",
  dormspacesLiked: "/dormspaces/liked",
  search: "/dormspaces/search",
  dormspacesLandlords: "/dormspaces/landlords",
  dormspacesDashboard: "/dormspaces/dashboard/listings",
  dormspacesSubmit: "/dormspaces/submit",
  dormspacesWelcome: "/dormspaces/welcome",
  faq: "/faq",
  settings: "/settings",
  bahaygoHome: "/",
  authLogin: "/auth/login?next=/dormspaces/more",
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

function isDormspaceLandlordUser(
  profile: { is_landlord: boolean; role: string; landlord_verification_status: string } | null,
): boolean {
  if (!profile) return false;
  if (isLandlordCapable(profile)) return true;
  const status = profile.landlord_verification_status;
  return status === "approved" || status === "pending";
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

export default function DormspacesMorePage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const isSignedIn = Boolean(user);
  const isLandlordUser = isDormspaceLandlordUser(profile);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/dormspaces");
    router.refresh();
  }, [router]);

  const sections = useMemo((): MenuSection[] => {
    const browseItems: MenuItem[] = [];
    if (ROUTES.dormspaces) {
      browseItems.push({
        id: "all-dormspaces",
        label: "All dormspaces",
        icon: Bed,
        href: PATHS.dormspaces,
      });
    }
    if (ROUTES.dormspacesLiked) {
      browseItems.push({
        id: "saved-dormspaces",
        label: "Saved dormspaces",
        icon: Heart,
        href: PATHS.dormspacesLiked,
      });
    }
    if (ROUTES.search) {
      browseItems.push({
        id: "browse-area",
        label: "Browse by area",
        icon: MapPin,
        href: PATHS.search,
      });
    }
    if (ROUTES.dormspacesLandlords) {
      browseItems.push({
        id: "featured-landlords",
        label: "Featured landlords",
        icon: Users,
        href: PATHS.dormspacesLandlords,
      });
    }

    const landlordItems: MenuItem[] = [];
    if (isLandlordUser) {
      if (ROUTES.dormspacesDashboard) {
        landlordItems.push({
          id: "landlord-dashboard",
          label: "Landlord dashboard",
          icon: LayoutDashboard,
          href: PATHS.dormspacesDashboard,
        });
      }
      if (ROUTES.dormspacesSubmit) {
        landlordItems.push({
          id: "add-dormspace",
          label: "Add new dormspace",
          icon: Plus,
          href: PATHS.dormspacesSubmit,
        });
      }
    } else if (ROUTES.dormspacesWelcome) {
      landlordItems.push({
        id: "list-dormspace",
        label: "List your dormspace",
        icon: Plus,
        href: PATHS.dormspacesWelcome,
      });
    }

    const helpItems: MenuItem[] = [
      ...(ROUTES.faq
        ? [{ id: "faq", label: "FAQ", icon: HelpCircle, href: PATHS.faq }]
        : []),
      {
        id: "contact",
        label: "Contact",
        icon: Mail,
        href: "mailto:support@bahaygo.com",
      },
      {
        id: "report-listing",
        label: "Report a listing",
        icon: Flag,
        href: "mailto:support@bahaygo.com?subject=Dormspace%20Report",
      },
    ];

    const switchItems: MenuItem[] = [
      {
        id: "switch-bahaygo",
        label: "Switch to BahayGo",
        icon: ArrowRight,
        href: PATHS.bahaygoHome,
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
    if (browseItems.length > 0) {
      result.push({ id: "browse", title: "Browse", items: browseItems });
    }
    if (landlordItems.length > 0) {
      result.push({ id: "landlord", title: "Landlord", items: landlordItems });
    }
    if (helpItems.length > 0) {
      result.push({ id: "help", title: "Help and information", items: helpItems });
    }
    if (switchItems.length > 0) {
      result.push({ id: "switch", title: "Switch context", items: switchItems });
    }
    if (accountItems.length > 0) {
      result.push({ id: "account", title: "Account", items: accountItems });
    }
    return result;
  }, [handleSignOut, isLandlordUser, isSignedIn]);

  const displayName = profile?.full_name?.trim() || "Your account";
  const email = user?.email ?? "";
  const showLandlordBadge = isLandlordUser;

  const mobileGridItems = useMemo(
    (): MobileMoreGridItem[] =>
      sections.flatMap((section) =>
        section.items.map((item) => ({
          id: item.id,
          label: item.label,
          icon: item.icon,
          href: item.href,
          onClick: item.onClick,
          destructive: item.destructive,
        })),
      ),
    [sections],
  );

  return (
    <DormspacePortalShell variant="browse" className="max-md:overflow-hidden">
      <MobileMoreTruliaGrid
        items={mobileGridItems}
        loading={loading}
        signedIn={isSignedIn}
        signInHref={PATHS.authLogin}
        signInLabel="Sign in or create account"
        profileHref={PATHS.settings}
        profileName={displayName}
        profileEmail={email}
        profileAvatarUrl={profile?.avatar_url}
        profileInitials={profileInitials(profile?.full_name, email)}
        profileBadge={showLandlordBadge ? "Landlord" : undefined}
      />

      <div className="hidden min-h-screen font-sans text-[#2C2C2C] md:block">
      <div className="pb-32 pt-[env(safe-area-inset-top,0px)] md:pt-4">
        {!loading && isSignedIn ? (
          <Link
            href={PATHS.settings}
            className="mx-4 mb-4 mt-6 flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white p-4 transition-colors hover:bg-black/[0.02] active:bg-black/[0.04]"
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
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-base font-semibold text-[#2C2C2C]">{displayName}</p>
                {showLandlordBadge ? (
                  <span className="shrink-0 rounded-full bg-[#6B9E6E]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B9E6E]">
                    Landlord
                  </span>
                ) : null}
              </div>
              {email ? <p className="truncate text-xs text-[#888888]">{email}</p> : null}
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-[#888888]" aria-hidden />
          </Link>
        ) : null}

        {!loading && !isSignedIn ? (
          <div className="mx-4 mb-4 mt-6 rounded-xl border border-black/[0.06] bg-white p-4">
            <p className="text-sm text-[#2C2C2C]/70">
              Sign in to save dormspaces, manage listings, and access your account.
            </p>
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
    </DormspacePortalShell>
  );
}

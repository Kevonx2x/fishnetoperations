"use client";

import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import { BahayGoHouseMark, DormspaceBrandIcon } from "@/components/dormspaces/dormspace-welcome-logo";
import {
  MobileMoreSectionedGrid,
  type MobileMoreGridSection,
} from "@/components/mobile/mobile-more-sectioned-grid";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, type ReactNode } from "react";
import {
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
  description?: string;
  icon?: LucideIcon;
  iconMarkup?: ReactNode;
  href?: string;
  badge?: string;
  badgeGold?: boolean;
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

function isDormspaceLandlordUser(
  profile: { is_landlord: boolean; role: string; landlord_verification_status: string } | null,
): boolean {
  if (!profile) return false;
  if (isLandlordCapable(profile)) return true;
  const status = profile.landlord_verification_status;
  return status === "approved" || status === "pending";
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
    const bahaygoFeatured: MenuItem = {
      id: "bahaygo",
      label: "BahayGo",
      iconMarkup: <BahayGoHouseMark className="h-5 w-5" />,
      href: PATHS.bahaygoHome,
    };

    const browseItems: MenuItem[] = [];
    if (ROUTES.dormspaces) {
      browseItems.push({
        id: "all-dormspaces",
        label: "All dormspaces",
        iconMarkup: <DormspaceBrandIcon />,
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
    result.push({ id: "browse", title: "Browse", featuredItem: bahaygoFeatured, items: browseItems });
    if (landlordItems.length > 0) {
      result.push({ id: "landlord", title: "Landlord", items: landlordItems });
    }
    if (helpItems.length > 0) {
      result.push({ id: "help", title: "Help and information", items: helpItems });
    }
    if (accountItems.length > 0) {
      result.push({ id: "account", title: "Account", items: accountItems });
    }
    return result;
  }, [handleSignOut, isLandlordUser, isSignedIn]);

  const displayName = profile?.full_name?.trim() || "Your account";
  const email = user?.email ?? "";
  const showLandlordBadge = isLandlordUser;

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
    <DormspacePortalShell variant="browse" className="max-md:overflow-hidden">
      <MobileMoreSectionedGrid
        sections={mobileSections}
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
        showFlagWatermark={false}
        showFooter
      />
    </DormspacePortalShell>
  );
}

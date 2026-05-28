"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Heart,
  HelpCircle,
  Home,
  Inbox,
  LogOut,
  User,
} from "lucide-react";

import { BahayGoHouseMark, DormspaceWelcomeLogo } from "@/components/dormspaces/dormspace-welcome-logo";
import { useAuth } from "@/contexts/auth-context";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import { isLandlordCapable } from "@/lib/auth-roles";
import { canLikeDormspaces, dormspaceLogoHref } from "@/lib/dormspace-engagement";
import { isPublicDormspaceMarketplacePath } from "@/lib/dormspace-portal-chrome";
import {
  dormspaceCenterNavItems,
  isDormspaceNavLinkActive,
  resolveDormspaceNavVariant,
  type DormspacePortalNavVariant,
} from "@/lib/dormspace-portal-nav";
import { useDormspaceLikes } from "@/hooks/use-dormspace-likes";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_LINK =
  "rounded-lg px-1 py-0.5 text-sm font-semibold text-[#404040] transition hover:text-[#2C2C2C]";

const DROPDOWN_ITEM =
  "flex w-full items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 transition hover:bg-[#FAF8F4]";

const DROPDOWN_DIVIDER = "my-1.5 h-px bg-[#2C2C2C]/10";

type AccountMenuProps = {
  isLandlord: boolean;
  inquiryCount: number;
  onNavigate: () => void;
  onSignOut: () => void;
  signOutBusy: boolean;
};

function AccountDropdownMenu({
  isLandlord,
  inquiryCount,
  onNavigate,
  onSignOut,
  signOutBusy,
}: AccountMenuProps) {
  const profileSettingsHref = isLandlord
    ? "/dormspaces/dashboard/profile"
    : "/settings";

  return (
    <>
      {isLandlord ? (
        <>
          <Link
            href="/dormspaces/dashboard/listings"
            className={DROPDOWN_ITEM}
            onClick={onNavigate}
            role="menuitem"
          >
            <Home className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
            My Listings
          </Link>
          {inquiryCount > 0 ? (
            <Link
              href="/dormspaces/dashboard/inquiries"
              className={DROPDOWN_ITEM}
              onClick={onNavigate}
              role="menuitem"
            >
              <Inbox className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
              Inquiries
            </Link>
          ) : null}
          <Link
            href={profileSettingsHref}
            className={DROPDOWN_ITEM}
            onClick={onNavigate}
            role="menuitem"
          >
            <User className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
            Profile settings
          </Link>
        </>
      ) : (
        <Link
          href={profileSettingsHref}
          className={DROPDOWN_ITEM}
          onClick={onNavigate}
          role="menuitem"
        >
          <User className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
          Profile settings
        </Link>
      )}
      <div className={DROPDOWN_DIVIDER} role="separator" />
      <Link href="/" className={DROPDOWN_ITEM} onClick={onNavigate} role="menuitem" aria-label="Bahaygo Main">
        <BahayGoHouseMark />
        Bahaygo Main
      </Link>
      <div className={DROPDOWN_DIVIDER} role="separator" />
      <button
        type="button"
        onClick={onSignOut}
        disabled={signOutBusy}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        role="menuitem"
      >
        <LogOut className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
        {signOutBusy ? "…" : "Log out"}
      </button>
    </>
  );
}

type Props = {
  variant?: DormspacePortalNavVariant;
  /** Landlord dashboard tab highlight */
  activeLandlordTab?: "listings" | "inquiries" | "profile" | "account";
  /** Minimal header on welcome (logo + browse only) */
  minimal?: boolean;
  /** Inside unified mobile home sticky — no separate sticky/safe-area shell. */
  embedded?: boolean;
};

function ResourcesMenu({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = [{ label: "Help & FAQ", href: "/faq", icon: HelpCircle }];

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        if (leaveTimer.current) clearTimeout(leaveTimer.current);
        setOpen(true);
      }}
      onMouseLeave={() => {
        leaveTimer.current = setTimeout(() => setOpen(false), 140);
      }}
    >
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-semibold text-[#404040] transition hover:text-[#2C2C2C]"
        aria-expanded={open}
      >
        Resources
        <span className="text-[10px] opacity-60">▾</span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 top-full z-[60] mt-2 w-56 rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/5"
          >
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 transition hover:bg-[#FAF8F4]"
              >
                <item.icon className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                {item.label}
              </Link>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function DormspacePortalNav({ variant: variantProp, activeLandlordTab, minimal, embedded }: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile, loading } = useAuth();
  const { dbIds, mayLike } = useDormspaceLikes();

  const isLandlord = isLandlordCapable(profile);
  const variant = resolveDormspaceNavVariant(profile, variantProp);
  const logoHref = dormspaceLogoHref();

  const [accountOpen, setAccountOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [inquiryCount, setInquiryCount] = useState(0);
  const accountRef = useRef<HTMLDivElement | null>(null);

  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "Member";
  const email = user?.email ?? "";

  const centerItems = dormspaceCenterNavItems(variant, profile?.role, pathname);

  useEffect(() => {
    if (!accountOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [accountOpen]);

  useEffect(() => {
    if (!user || !isLandlord) {
      setInquiryCount(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/dormspaces/landlord/inquiries", { credentials: "include" });
        const json = (await res.json()) as { success?: boolean; data?: { items?: unknown[] } };
        if (!cancelled && res.ok) {
          setInquiryCount(json.data?.items?.length ?? 0);
        }
      } catch {
        if (!cancelled) setInquiryCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isLandlord]);

  const scrollToListings = () => {
    if (pathname === "/dormspaces") {
      document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push("/dormspaces#listings");
    }
  };

  const signOut = async () => {
    setSignOutBusy(true);
    setAccountOpen(false);
    try {
      await supabase.auth.signOut();
      router.refresh();
    } finally {
      setSignOutBusy(false);
    }
  };

  const navLinkActive = (key: string) => {
    if (variant === "landlord" && activeLandlordTab) {
      if (key === "listings") return activeLandlordTab === "listings";
    }
    const item = centerItems.find((i) => i.key === key);
    return item ? isDormspaceNavLinkActive(item, pathname) : false;
  };

  const renderCenterLink = (item: (typeof centerItems)[number]) => {
    const active = navLinkActive(item.key);
    if (item.scrollToListings) {
      return (
        <button
          key={item.key}
          type="button"
          onClick={scrollToListings}
          className={cn(NAV_LINK, active && "text-[#2C2C2C]")}
        >
          {item.label}
        </button>
      );
    }
    return (
      <Link
        key={item.key}
        href={item.href}
        className={cn(NAV_LINK, active && "text-[#2C2C2C]")}
      >
        {item.label}
      </Link>
    );
  };

  const signInHref = `/auth/login?next=${encodeURIComponent(pathname || "/dormspaces")}`;

  const bar = (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-3">
      <div className="flex min-w-0 items-center justify-self-start">
        <DormspaceWelcomeLogo href={logoHref} />
      </div>

      {!minimal ? (
        <nav className="hidden items-center justify-center gap-6 sm:flex">
          {centerItems.map(renderCenterLink)}
          <ResourcesMenu />
        </nav>
      ) : (
        <nav className="hidden items-center justify-center gap-6 sm:flex">
          <Link href="/dormspaces" className={NAV_LINK}>
            Browse dormspaces
          </Link>
        </nav>
      )}

      <div className="flex items-center gap-2 justify-self-end">
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded-full bg-black/5" />
        ) : user ? (
          <>
            {mayLike && dbIds.length > 0 ? (
              <Link
                href="/dormspaces/liked"
                className="relative inline-flex rounded-full border border-black/10 bg-white p-2 text-[#2C2C2C]/75 shadow-sm transition hover:bg-white/90"
                aria-label={`${dbIds.length} liked dormspaces`}
              >
                <Heart className="h-4 w-4 fill-red-500 text-red-500" aria-hidden />
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#6B9E6E] px-1 text-[10px] font-bold text-white">
                  {dbIds.length > 9 ? "9+" : dbIds.length}
                </span>
              </Link>
            ) : null}
            {isLandlord ? (
              <Link
                href="/dormspaces/submit?from=welcome"
                className="hidden h-9 items-center justify-center rounded-xl bg-[#6B9E6E] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#5d8a60] sm:inline-flex"
              >
                List Your Space
              </Link>
            ) : null}
            <button
              type="button"
              className="relative inline-flex rounded-full border border-black/10 bg-white p-2 text-[#2C2C2C]/75 shadow-sm transition hover:bg-white/90"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" aria-hidden />
            </button>
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white shadow-sm ring-2 ring-[#D4A843]/25 transition hover:bg-[#FAF8F4]"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[#6B9E6E] text-xs font-semibold text-white">
                    {profile?.full_name?.trim()
                      ? agentAvatarInitials(profile.full_name)
                      : (email[0] ?? "?").toUpperCase()}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {accountOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-[70] mt-2 w-64 rounded-xl border border-black/10 bg-white py-2 shadow-lg ring-1 ring-black/5"
                    role="menu"
                  >
                    <div className="px-3 pb-2 pt-1">
                      <p className="truncate text-sm font-semibold text-[#525252]">{displayName}</p>
                      <p className="mt-0.5 truncate text-xs text-[#2C2C2C]/40">{email}</p>
                    </div>
                    <div className={DROPDOWN_DIVIDER} />
                    <AccountDropdownMenu
                      isLandlord={isLandlord}
                      inquiryCount={inquiryCount}
                      onNavigate={() => setAccountOpen(false)}
                      onSignOut={() => void signOut()}
                      signOutBusy={signOutBusy}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <>
            <Link
              href="/dormspaces/welcome?intent=signin#get-started"
              className="hidden text-sm font-semibold text-[#404040] transition hover:text-[#2C2C2C] sm:inline"
            >
              Sign In
            </Link>
            <Link
              href="/dormspaces/welcome?intent=signup#get-started"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-[#1a2e22] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#243828]"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </div>
  );

  return (
    <Fragment>
      {embedded ? (
        bar
      ) : (
      <header
        className={cn(
          "sticky top-0 z-50 w-full border-b border-black/[0.06] bg-[#FAF8F4]/95 pt-[env(safe-area-inset-top,0px)] shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-[#FAF8F4]/90",
          !isPublicDormspaceMarketplacePath(pathname) && "md:border-[#2C2C2C]/10",
        )}
      >
        {bar}
      </header>
      )}
    </Fragment>
  );
}

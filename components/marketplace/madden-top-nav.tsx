"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  BarChart3,
  Bell,
  Bot,
  Building2,
  GitCompare,
  GitBranch,
  Globe,
  GraduationCap,
  Heart,
  HeartHandshake,
  Home,
  Hospital,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  Palmtree,
  Search,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Train,
  TrendingUp,
  User,
  UserPlus,
  Users,
  BadgeCheck,
  LayoutTemplate,
  Pin,
  Menu,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import { BahayGoWordmark } from "@/components/marketplace/bahaygo-wordmark";
import {
  AGENT_AVAILABILITY_NOW,
  AGENT_AVAILABILITY_OFFLINE,
  isAgentAvailableNow,
} from "@/components/marketplace/agent-availability-badge";
type NavLinkItem = { kind: "link"; label: string; href: string; icon: ReactNode };
type NavDividerItem = { kind: "divider"; label: string };
type NavPendingItem = { kind: "pending"; label: string; icon: ReactNode };
type NavDropdownEntry = NavLinkItem | NavDividerItem | NavPendingItem;

/** Dropdown labels that are not live yet — show a small Coming Soon pill (exact match to `label` strings). */
const COMING_SOON_NAV_LABELS = new Set([
  "Top Brokerages",
  "Near Schools",
  "Near Hospitals",
  "Near Malls",
  "Near Parks & Recreation",
  "Near Business Districts (BGC, Makati, Ortigas)",
  "Near Transportation Hubs",
  "Foreclosures & Deals",
  "Luxury Homes ₱50M+",
  "Near Business Districts",
]);

const BAHAYGO_LANGUAGE_KEY = "bahaygo-language";

function NavLanguageRow({
  uiLanguage,
  onSetLanguage,
  className,
}: {
  uiLanguage: "en" | "fil";
  onSetLanguage: (v: "en" | "fil") => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Globe className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
      <span className="text-sm font-semibold text-[#2C2C2C]/85">Language</span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onSetLanguage("en")}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none transition",
            uiLanguage === "en"
              ? "bg-[#6B9E6E] text-white"
              : "bg-transparent text-[#2C2C2C]/60 ring-1 ring-inset ring-[#2C2C2C]/25",
          )}
        >
          <span aria-hidden>🇺🇸</span>
          EN
        </button>
        <button
          type="button"
          onClick={() => onSetLanguage("fil")}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none transition",
            uiLanguage === "fil"
              ? "bg-[#6B9E6E] text-white"
              : "bg-transparent text-[#2C2C2C]/60 ring-1 ring-inset ring-[#2C2C2C]/25",
          )}
        >
          <span aria-hidden>🇵🇭</span>
          FIL
        </button>
      </div>
    </div>
  );
}

function MobileNavSection({
  title,
  entries,
  onNavigate,
}: {
  title: string;
  entries: NavDropdownEntry[];
  onNavigate: () => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#2C2C2C]/40">{title}</p>
      <ul className="mt-2 space-y-0.5">
        {entries.map((it, i) => {
          if (it.kind === "divider") {
            return (
              <li key={`d-${title}-${i}`} className="py-2">
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#2C2C2C]/35">
                  {it.label}
                </p>
              </li>
            );
          }
          if (it.kind === "pending") {
            return (
              <li
                key={`p-${title}-${i}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold italic text-[#2C2C2C]/35"
              >
                <span className="text-[#6B9E6E]/40 [&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>
                <span className="flex-1">{it.label}</span>
                <span className="shrink-0 text-[10px] font-bold text-[#8a6d32]">Soon</span>
              </li>
            );
          }
          return (
            <li key={it.href + it.label}>
              <Link
                href={it.href}
                onClick={onNavigate}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 transition hover:bg-white"
              >
                <span className="text-[#6B9E6E] [&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>
                <span className="min-w-0 flex-1">{it.label}</span>
                {COMING_SOON_NAV_LABELS.has(it.label) ? (
                  <span className="ml-2 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                    Coming Soon
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NavDropdownMenu({ label, entries }: { label: string; entries: NavDropdownEntry[] }) {
  const [open, setOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setOpen(true);
  };
  const onLeave = () => {
    leaveTimer.current = setTimeout(() => setOpen(false), 140);
  };

  return (
    <div className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        type="button"
        className="flex items-center gap-1 rounded-lg px-1 py-0.5 text-sm font-semibold text-[#2C2C2C]/70 transition hover:text-[#2C2C2C]"
        aria-expanded={open}
      >
        {label}
        <span className="text-[10px] opacity-60">▾</span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="absolute left-1/2 top-full z-[60] mt-2 w-72 -translate-x-1/2 rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/5"
          >
            <ul className="space-y-0.5">
              {entries.map((it, i) => {
                if (it.kind === "divider") {
                  return (
                    <li key={`d-${i}-${it.label}`} className="px-2 py-2">
                      <p className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[#2C2C2C]/40">
                        ── {it.label} ──
                      </p>
                    </li>
                  );
                }
                if (it.kind === "pending") {
                  return (
                    <li
                      key={`p-${i}-${it.label}`}
                      className="flex cursor-default select-none items-center gap-2 rounded-lg px-3 py-2.5"
                    >
                      <span className="text-[#6B9E6E]/40 [&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>
                      <span className="flex-1 text-sm font-semibold italic text-gray-300">{it.label}</span>
                      <span className="shrink-0 rounded-full bg-[#D4A843]/18 px-1.5 py-0.5 text-[10px] font-bold text-[#8a6d32]">
                        (Soon)
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={it.href + it.label}>
                    <Link
                      href={it.href}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/80 transition hover:bg-[#FAF8F4]"
                    >
                      <span className="text-[#6B9E6E] [&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>
                      <span className="min-w-0 flex-1">{it.label}</span>
                      {COMING_SOON_NAV_LABELS.has(it.label) ? (
                        <span className="ml-2 shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                          Coming Soon
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function MaddenTopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const isBuyPage = pathname === "/buy";
  const { user, profile, role, loading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);
  const [agentNav, setAgentNav] = useState<{
    id: string;
    image_url: string | null;
    availability: string | null;
  } | null>(null);
  const [availToggling, setAvailToggling] = useState(false);
  const [brokerNav, setBrokerNav] = useState<{ id: string } | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);
  const [uiLanguage, setUiLanguage] = useState<"en" | "fil">("en");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BAHAYGO_LANGUAGE_KEY);
      if (raw === "fil" || raw === "en") setUiLanguage(raw);
    } catch {
      /* ignore */
    }
  }, []);

  const setUiLanguagePersist = useCallback((next: "en" | "fil") => {
    setUiLanguage(next);
    try {
      localStorage.setItem(BAHAYGO_LANGUAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setAgentNav(null);
      setBrokerNav(null);
      setNotifUnread(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [{ data: a }, { data: b }] = await Promise.all([
        supabase.from("agents").select("id, image_url, availability").eq("user_id", user.id).maybeSingle(),
        supabase.from("brokers").select("id").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (a) {
        const row = a as { id: string; image_url?: string | null; availability?: string | null };
        setAgentNav({
          id: row.id,
          image_url: row.image_url ?? null,
          availability: row.availability ?? null,
        });
      } else {
        setAgentNav(null);
      }
      setBrokerNav(b ? { id: b.id as string } : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, supabase]);

  const refreshNotificationCounts = useCallback(async () => {
    if (!user?.id) {
      setNotifUnread(0);
      return;
    }
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    setNotifUnread(count ?? 0);
  }, [user?.id, supabase]);

  useEffect(() => {
    void refreshNotificationCounts();
  }, [refreshNotificationCounts]);

  useEffect(() => {
    const onRead = () => {
      void refreshNotificationCounts();
    };
    window.addEventListener("bahaygo:notifications-read", onRead);
    return () => window.removeEventListener("bahaygo:notifications-read", onRead);
  }, [refreshNotificationCounts]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (accountRef.current && !accountRef.current.contains(t)) setAccountOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      window.location.href = "/auth/signout";
    } finally {
      setBusy(false);
    }
  };

  const toggleAgentAvailability = async () => {
    if (!user?.id || !agentNav || role !== "agent" || availToggling) return;
    setAvailToggling(true);
    const next = isAgentAvailableNow(agentNav.availability) ? AGENT_AVAILABILITY_OFFLINE : AGENT_AVAILABILITY_NOW;
    const { error } = await supabase.from("agents").update({ availability: next }).eq("user_id", user.id);
    if (!error) {
      setAgentNav((prev) => (prev ? { ...prev, availability: next } : null));
    }
    setAvailToggling(false);
  };

  const publicAgentsEntries: NavDropdownEntry[] = useMemo(
    () => [
      { kind: "link", label: "Become an Agent →", href: "/register/agent", icon: <UserPlus /> },
      { kind: "link", label: "Find an Agent", href: "/agents", icon: <Search /> },
      { kind: "link", label: "Top Agents This Week", href: "/agents?sort=top", icon: <TrendingUp /> },
      { kind: "link", label: "Agents by Specialty", href: "/agents?filter=specialty", icon: <Award /> },
      { kind: "link", label: "Agents by Location", href: "/agents?filter=location", icon: <MapPin /> },
    ],
    [],
  );

  const agentLoggedAgentsEntries: NavDropdownEntry[] = useMemo(() => {
    if (!agentNav) return publicAgentsEntries;
    return [
      { kind: "link", label: "My Dashboard", href: "/dashboard/agent", icon: <LayoutDashboard /> },
      { kind: "link", label: "My Listings", href: "/dashboard/agent?tab=listings", icon: <Home /> },
      { kind: "link", label: "My Profile", href: `/agents/${agentNav.id}`, icon: <User /> },
      { kind: "divider", label: "COMING SOON" },
      { kind: "pending", label: "Agent Analytics", icon: <BarChart3 /> },
      { kind: "pending", label: "Team Collaboration", icon: <Users /> },
      { kind: "pending", label: "AI Listing Assistant", icon: <Bot /> },
    ];
  }, [agentNav, publicAgentsEntries]);

  const clientAgentsEntries: NavDropdownEntry[] = useMemo(
    () => [
      { kind: "link", label: "Become an Agent →", href: "/register/agent", icon: <UserPlus /> },
      { kind: "link", label: "Find an Agent", href: "/agents", icon: <Search /> },
      { kind: "link", label: "Top Agents This Week", href: "/agents", icon: <TrendingUp /> },
      { kind: "divider", label: "COMING SOON" },
      { kind: "pending", label: "Agent Comparison Tool", icon: <GitCompare /> },
    ],
    [],
  );

  const agentsEntries: NavDropdownEntry[] = useMemo(() => {
    if (!user) return publicAgentsEntries;
    if (role === "agent" && agentNav) return agentLoggedAgentsEntries;
    if (role === "client") return clientAgentsEntries;
    return publicAgentsEntries;
  }, [user, role, agentNav, publicAgentsEntries, agentLoggedAgentsEntries, clientAgentsEntries]);

  const publicBrokersEntries: NavDropdownEntry[] = useMemo(
    () => [
      { kind: "link", label: "Find a Broker", href: "/brokers", icon: <Building2 /> },
      { kind: "link", label: "Top Brokerages", href: "/brokers?sort=top", icon: <Star /> },
      { kind: "link", label: "Register as Broker →", href: "/contact", icon: <HeartHandshake /> },
      { kind: "link", label: "Verify My License →", href: "/contact", icon: <ShieldCheck /> },
    ],
    [],
  );

  const brokerLoggedBrokersEntries: NavDropdownEntry[] = useMemo(() => {
    if (!brokerNav) return publicBrokersEntries;
    return [
      { kind: "link", label: "My Dashboard", href: "/dashboard/broker", icon: <LayoutDashboard /> },
      { kind: "link", label: "My Agents", href: "/dashboard/broker?tab=agents", icon: <Users /> },
      { kind: "link", label: "My Profile", href: `/brokers/${brokerNav.id}`, icon: <Building2 /> },
      { kind: "divider", label: "COMING SOON" },
      { kind: "pending", label: "Broker Analytics", icon: <BarChart3 /> },
      { kind: "pending", label: "Lead Distribution", icon: <Share2 /> },
      { kind: "pending", label: "White Label Portal", icon: <LayoutTemplate /> },
    ];
  }, [brokerNav, publicBrokersEntries]);

  const brokersEntries: NavDropdownEntry[] = useMemo(() => {
    if (!user) return publicBrokersEntries;
    if (role === "broker" && brokerNav) return brokerLoggedBrokersEntries;
    return publicBrokersEntries;
  }, [user, role, brokerNav, publicBrokersEntries, brokerLoggedBrokersEntries]);

  const landmarksItems: NavDropdownEntry[] = useMemo(
    () => [
      { kind: "link", label: "Near Schools", href: "/landmarks?type=schools", icon: <GraduationCap /> },
      { kind: "link", label: "Near Hospitals", href: "/landmarks?type=hospitals", icon: <Hospital /> },
      { kind: "link", label: "Near Malls", href: "/landmarks?type=malls", icon: <Store /> },
      { kind: "link", label: "Near Parks & Recreation", href: "/landmarks?type=parks", icon: <Palmtree /> },
      { kind: "link", label: "Near Business Districts (BGC, Makati, Ortigas)", href: "/landmarks?type=business", icon: <Building2 /> },
      { kind: "link", label: "Near Transportation Hubs", href: "/landmarks?type=transport", icon: <Train /> },
    ],
    [],
  );

  const buyWhenOnRentItems: NavDropdownEntry[] = useMemo(
    () => [
      { kind: "link", label: "New Listings for Sale", href: "/buy#listings", icon: <Sparkles /> },
      { kind: "link", label: "Luxury Homes ₱50M+", href: "/buy?focus=luxury#listings", icon: <Star /> },
      { kind: "link", label: "Foreclosures & Deals", href: "/buy?focus=deals#listings", icon: <TrendingUp /> },
      { kind: "link", label: "Open House This Weekend", href: "/buy?focus=open#listings", icon: <Landmark /> },
      { kind: "link", label: "Browse by Location", href: "/buy#featured-locations", icon: <MapPin /> },
    ],
    [],
  );

  const rentWhenOnBuyItems: NavDropdownEntry[] = useMemo(
    () => [
      { kind: "link", label: "New Rentals", href: "/#listings", icon: <Sparkles /> },
      { kind: "link", label: "Pet Friendly", href: "/?focus=pet", icon: <Users /> },
      { kind: "link", label: "Furnished & Move-in Ready", href: "/?focus=furnished", icon: <BadgeCheck /> },
      { kind: "link", label: "Short Term Rentals", href: "/?focus=short", icon: <ShoppingBag /> },
      { kind: "link", label: "Near Business Districts", href: "/?focus=bd", icon: <Building2 /> },
    ],
    [],
  );

  const closeMobileNav = () => setMobileMenuOpen(false);

  return (
    <Fragment>
    <header className="sticky top-0 z-50 w-full border-b border-[#2C2C2C]/10 bg-[#FAF8F4]/95 backdrop-blur-sm">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-4 md:gap-3">
        <div className="flex items-center gap-2 justify-self-start">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="rounded-lg p-2 text-[#2C2C2C]/80 ring-1 ring-black/5 transition hover:bg-[#FAF8F4] sm:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center leading-none"
            aria-label="BahayGo home"
          >
            <span className="inline-flex items-center gap-2 sm:hidden">
              <svg viewBox="0 0 40 36" className="h-9 w-auto shrink-0" aria-hidden>
                <path fill="#D4A843" d="M20 2 L36 14 L36 32 L4 32 L4 14 Z" />
                <rect x="16" y="22" width="8" height="10" rx="1" fill="#FAF8F4" />
              </svg>
              <span className="inline-flex items-baseline font-serif text-[1.35rem] font-semibold leading-none tracking-tight">
                <span className="text-[#2C2C2C]">Bahay</span>
                <span className="text-[#6B9E6E]">Go</span>
              </span>
            </span>
            <span className="hidden sm:inline">
              <BahayGoWordmark />
            </span>
          </Link>
        </div>

        <nav className="hidden min-w-0 justify-self-center sm:flex items-center gap-5 text-sm font-semibold text-[#2C2C2C]/70 md:gap-6">
          <NavDropdownMenu label="Agents" entries={agentsEntries} />
          <NavDropdownMenu label="Brokers" entries={brokersEntries} />
          <NavDropdownMenu label="Landmarks" entries={landmarksItems} />
          {isBuyPage ? (
            <NavDropdownMenu label="Rent" entries={rentWhenOnBuyItems} />
          ) : (
            <NavDropdownMenu label="Buy" entries={buyWhenOnRentItems} />
          )}
        </nav>

        <div className="justify-self-end flex items-center gap-2">
          {loading ? (
            <div className="h-9 w-20 animate-pulse rounded-full bg-black/5" />
          ) : user ? (
            <>
              {role === "client" && user.id ? (
                <Link
                  href={`/clients/${user.id}`}
                  className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#2C2C2C]/75 transition hover:bg-white/80 hover:text-[#2C2C2C] sm:inline-flex"
                >
                  <User className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                  My Profile
                </Link>
              ) : null}
              {role === "agent" && agentNav ? (
                <Link
                  href={`/agents/${agentNav.id}`}
                  className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#2C2C2C]/75 transition hover:bg-white/80 hover:text-[#2C2C2C] sm:inline-flex"
                >
                  <User className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                  My Profile
                </Link>
              ) : null}
              <Link
                href="/notifications"
                className="relative inline-flex rounded-full border border-black/10 bg-white p-2 text-[#2C2C2C]/75 shadow-sm transition hover:bg-[#FAF8F4]"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {notifUnread > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D4A843] px-1 text-[10px] font-bold text-[#2C2C2C]">
                    {notifUnread > 9 ? "9+" : notifUnread}
                  </span>
                ) : null}
              </Link>
              <div className="relative" ref={accountRef}>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountOpen((o) => !o)}
                    className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white shadow-sm ring-2 ring-[#D4A843]/25 hover:bg-[#FAF8F4]"
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                  >
                    {agentNav?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={agentNav.image_url} alt="" className="h-full w-full object-cover" />
                    ) : profile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-[#6B9E6E] text-xs font-bold text-white">
                        {profile?.full_name?.trim()
                          ? agentAvatarInitials(profile.full_name)
                          : (user.email?.[0] ?? "?").toUpperCase()}
                      </span>
                    )}
                  </button>
                  {role === "agent" && agentNav ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleAgentAvailability();
                      }}
                      disabled={availToggling}
                      title={
                        isAgentAvailableNow(agentNav.availability)
                          ? "You are online"
                          : "You are offline"
                      }
                      aria-label={
                        isAgentAvailableNow(agentNav.availability)
                          ? "You are online. Click to go offline."
                          : "You are offline. Click to go available now."
                      }
                      className={`absolute -bottom-0.5 -right-0.5 z-10 h-3 w-3 rounded-full border-2 border-white shadow-sm transition ${
                        isAgentAvailableNow(agentNav.availability) ? "bg-[#6B9E6E]" : "bg-[#9ca3af]"
                      } ${availToggling ? "opacity-60" : "hover:brightness-110"}`}
                    />
                  ) : null}
                </div>
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
                        <p className="truncate text-sm font-semibold text-[#2C2C2C]/45">
                          {profile?.full_name?.trim() || "Member"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[#2C2C2C]/40">{user.email ?? ""}</p>
                      </div>
                      <div className="my-1.5 h-px bg-[#2C2C2C]/10" />
                      <Link
                        href={
                          role === "client" && user?.id
                            ? `/clients/${user.id}`
                            : role === "agent" && agentNav
                              ? `/agents/${agentNav.id}`
                              : role === "broker" && brokerNav
                                ? `/brokers/${brokerNav.id}`
                                : "/settings"
                        }
                        className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                        onClick={() => setAccountOpen(false)}
                      >
                        <User className="h-4 w-4 shrink-0 text-[#6B9E6E]" />
                        My Profile
                      </Link>
                      {role === "agent" ? (
                        <>
                          <Link
                            href="/dashboard/agent"
                            className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                            onClick={() => setAccountOpen(false)}
                          >
                            <LayoutDashboard className="h-4 w-4 shrink-0 text-[#6B9E6E]" />
                            Agent Dashboard
                          </Link>
                          <Link
                            href="/dashboard/agent?tab=pipeline"
                            className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                            onClick={() => setAccountOpen(false)}
                          >
                            <GitBranch className="h-4 w-4 shrink-0 text-[#6B9E6E]" />
                            Pipeline
                          </Link>
                        </>
                      ) : (
                        <>
                          <Link
                            href="/likes"
                            className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                            onClick={() => setAccountOpen(false)}
                          >
                            <Heart className="h-4 w-4 shrink-0 text-[#6B9E6E]" />
                            My Likes
                          </Link>
                          {role === "client" && user?.id ? (
                            <Link
                              href={`/clients/${user.id}?tab=messages`}
                              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                              onClick={() => setAccountOpen(false)}
                            >
                              <MessageSquare className="h-4 w-4 shrink-0 text-[#6B9E6E]" />
                              Messages
                            </Link>
                          ) : null}
                          <Link
                            href="/saved"
                            className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                            onClick={() => setAccountOpen(false)}
                          >
                            <Pin className="h-4 w-4 shrink-0 text-[#D4A843]" />
                            Pinned properties
                          </Link>
                        </>
                      )}
                      <Link
                        href="/settings"
                        className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                        onClick={() => setAccountOpen(false)}
                      >
                        <Settings className="h-4 w-4 shrink-0 text-[#6B9E6E]" />
                        Settings
                      </Link>
                      <NavLanguageRow
                        uiLanguage={uiLanguage}
                        onSetLanguage={setUiLanguagePersist}
                        className="px-3 py-2.5"
                      />
                      {role === "agent" ? (
                        <>
                          <div className="my-1.5 h-px bg-[#2C2C2C]/10" />
                          <Link
                            href="/dashboard/agent?tab=listings"
                            className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                            onClick={() => setAccountOpen(false)}
                          >
                            <Home className="h-4 w-4 shrink-0 text-[#6B9E6E]" />
                            My Listings
                          </Link>
                        </>
                      ) : null}
                      {role === "broker" ? (
                        <>
                          <div className="my-1.5 h-px bg-[#2C2C2C]/10" />
                          <Link
                            href="/dashboard/broker"
                            className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                            onClick={() => setAccountOpen(false)}
                          >
                            <Building2 className="h-4 w-4 shrink-0 text-[#6B9E6E]" />
                            Broker Dashboard
                          </Link>
                        </>
                      ) : null}
                      {role === "admin" ? (
                        <>
                          <div className="my-1.5 h-px bg-[#2C2C2C]/10" />
                          <Link
                            href="/admin"
                            className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                            onClick={() => setAccountOpen(false)}
                          >
                            <Shield className="h-4 w-4 shrink-0 text-[#6B9E6E]" />
                            Admin Panel
                          </Link>
                        </>
                      ) : null}
                      <div className="my-1.5 h-px bg-[#2C2C2C]/10" />
                      <button
                        type="button"
                        onClick={() => void logout()}
                        disabled={busy}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        <LogOut className="h-4 w-4 shrink-0 text-red-600" />
                        {busy ? "…" : "Logout"}
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-[#FAF8F4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>

    {mobileMenuOpen && (
      <div
        className="sm:hidden"
        style={{ position: "fixed", inset: 0, zIndex: 9999 }}
        onClick={() => setMobileMenuOpen(false)}
      >
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "80%",
            maxWidth: "320px",
            height: "100vh",
            background: "white",
            zIndex: 9999,
            overflowY: "auto",
            boxShadow: "4px 0 20px rgba(0,0,0,0.15)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[#2C2C2C]/10 px-4 py-3">
            <span className="font-serif text-lg font-bold text-[#2C2C2C]">Menu</span>
            <button
              type="button"
              onClick={closeMobileNav}
              className="rounded-lg p-2 text-[#2C2C2C]/70 hover:bg-[#FAF8F4]"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-4 py-4">
            <div className="space-y-6">
              {user && role === "client" && user.id ? (
                <Link
                  href={`/clients/${user.id}`}
                  onClick={closeMobileNav}
                  className="flex items-center gap-2.5 rounded-lg border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 shadow-sm transition hover:bg-white"
                >
                  <User className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                  My Profile
                </Link>
              ) : null}
              {user && role === "agent" && agentNav ? (
                <Link
                  href={`/agents/${agentNav.id}`}
                  onClick={closeMobileNav}
                  className="flex items-center gap-2.5 rounded-lg border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 shadow-sm transition hover:bg-white"
                >
                  <User className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                  My Profile
                </Link>
              ) : null}
              {user && role === "broker" && brokerNav ? (
                <Link
                  href={`/brokers/${brokerNav.id}`}
                  onClick={closeMobileNav}
                  className="flex items-center gap-2.5 rounded-lg border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 shadow-sm transition hover:bg-white"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                  My Profile
                </Link>
              ) : null}
              <MobileNavSection title="Agents" entries={agentsEntries} onNavigate={closeMobileNav} />
              <MobileNavSection title="Brokers" entries={brokersEntries} onNavigate={closeMobileNav} />
              <MobileNavSection title="Landmarks" entries={landmarksItems} onNavigate={closeMobileNav} />
              <MobileNavSection
                title={isBuyPage ? "Rent" : "Buy"}
                entries={isBuyPage ? rentWhenOnBuyItems : buyWhenOnRentItems}
                onNavigate={closeMobileNav}
              />
            </div>
          </div>
        </div>
      </div>
    )}
    </Fragment>
  );
}

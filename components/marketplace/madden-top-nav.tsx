"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  BadgeCheck,
  Building2,
  GraduationCap,
  HeartHandshake,
  Hospital,
  Landmark,
  LogOut,
  MapPin,
  Palmtree,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Train,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type NavItem = { label: string; href: string; icon: ReactNode };

function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: NavItem[];
}) {
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
            className="absolute left-1/2 top-full z-[60] mt-2 w-64 -translate-x-1/2 rounded-xl bg-white p-2 shadow-lg ring-1 ring-black/5"
          >
            <ul className="space-y-0.5">
              {items.map((it) => (
                <li key={it.href + it.label}>
                  <Link
                    href={it.href}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/80 transition hover:bg-[#FAF8F4]"
                  >
                    <span className="text-[#7C9A7E] [&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function MaddenTopNav() {
  const pathname = usePathname();
  const isBuyPage = pathname === "/buy";
  const { user, loading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
    }
  };

  const agentsItems: NavItem[] = [
    { label: "Find an Agent", href: "/agents", icon: <Search /> },
    { label: "Top Agents This Week", href: "/agents?sort=top", icon: <TrendingUp /> },
    { label: "Agents by Specialty", href: "/agents?filter=specialty", icon: <Award /> },
    { label: "Agents by Location", href: "/agents?filter=location", icon: <MapPin /> },
    { label: "Become an Agent →", href: "/contact", icon: <UserPlus /> },
  ];

  const brokersItems: NavItem[] = [
    { label: "Find a Broker", href: "/brokers", icon: <Building2 /> },
    { label: "Top Brokerages", href: "/brokers?sort=top", icon: <Star /> },
    { label: "Register as Broker →", href: "/contact", icon: <HeartHandshake /> },
    { label: "Verify My License →", href: "/contact", icon: <ShieldCheck /> },
  ];

  const landmarksItems: NavItem[] = [
    { label: "Near Schools", href: "/landmarks?type=schools", icon: <GraduationCap /> },
    { label: "Near Hospitals", href: "/landmarks?type=hospitals", icon: <Hospital /> },
    { label: "Near Malls", href: "/landmarks?type=malls", icon: <Store /> },
    { label: "Near Parks & Recreation", href: "/landmarks?type=parks", icon: <Palmtree /> },
    { label: "Near Business Districts (BGC, Makati, Ortigas)", href: "/landmarks?type=business", icon: <Building2 /> },
    { label: "Near Transportation Hubs", href: "/landmarks?type=transport", icon: <Train /> },
  ];

  const buyWhenOnRentItems: NavItem[] = [
    { label: "New Listings for Sale", href: "/buy#listings", icon: <Sparkles /> },
    { label: "Luxury Homes ₱50M+", href: "/buy?focus=luxury#listings", icon: <Star /> },
    { label: "Foreclosures & Deals", href: "/buy?focus=deals#listings", icon: <TrendingUp /> },
    { label: "Open House This Weekend", href: "/buy?focus=open#listings", icon: <Landmark /> },
    { label: "Browse by Neighborhood", href: "/buy#neighborhoods", icon: <MapPin /> },
  ];

  const rentWhenOnBuyItems: NavItem[] = [
    { label: "New Rentals", href: "/#listings", icon: <Sparkles /> },
    { label: "Pet Friendly", href: "/?focus=pet", icon: <Users /> },
    { label: "Furnished & Move-in Ready", href: "/?focus=furnished", icon: <BadgeCheck /> },
    { label: "Short Term Rentals", href: "/?focus=short", icon: <ShoppingBag /> },
    { label: "Near Business Districts", href: "/?focus=bd", icon: <Building2 /> },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
      <div className="mx-auto grid max-w-6xl grid-cols-3 items-center px-4 py-4">
        <Link href="/" className="justify-self-start leading-none">
          <div className="font-serif text-xl font-bold tracking-tight text-[#2C2C2C]">
            Fishnet
          </div>
          <div className="mt-0.5 text-[11px] font-semibold tracking-[0.18em] text-[#2C2C2C]/50">
            RESIDENCES
          </div>
        </Link>

        <nav className="hidden justify-self-center sm:flex items-center gap-6 text-sm font-semibold text-[#2C2C2C]/70">
          <NavDropdown label="Agents" items={agentsItems} />
          <NavDropdown label="Brokers" items={brokersItems} />
          <NavDropdown label="Landmarks" items={landmarksItems} />
          {isBuyPage ? (
            <NavDropdown label="Rent" items={rentWhenOnBuyItems} />
          ) : (
            <NavDropdown label="Buy" items={buyWhenOnRentItems} />
          )}
        </nav>

        <div className="justify-self-end">
          {loading ? (
            <div className="h-9 w-20 animate-pulse rounded-full bg-black/5" />
          ) : user ? (
            <button
              type="button"
              onClick={() => void logout()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-[#FAF8F4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {busy ? "…" : "Logout"}
            </button>
          ) : (
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-semibold text-[#2C2C2C]/80 shadow-sm hover:bg-[#FAF8F4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

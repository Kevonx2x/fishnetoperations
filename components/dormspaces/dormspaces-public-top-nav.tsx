"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BookOpen, Home, LogOut, Menu, User, X } from "lucide-react";

import { DormspaceWelcomeLogo } from "@/components/dormspaces/dormspace-welcome-logo";
import { useAuth } from "@/contexts/auth-context";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import { isLandlordRole } from "@/lib/auth-roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const NAV_LINK =
  "rounded-lg px-1 py-0.5 text-sm font-semibold text-[#404040] transition hover:text-[#2C2C2C]";

function PublicResourcesMenu({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const items = [
    { label: "How verification works", href: "#" },
    { label: "Tips for landlords", href: "#" },
    { label: "Tips for tenants", href: "#" },
  ];

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
                <BookOpen className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                {item.label}
              </Link>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function DormspacesPublicTopNav() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile, loading } = useAuth();
  const isLandlord = isLandlordRole(profile?.role);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "Member";
  const email = user?.email ?? "";

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
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const scrollToListings = () => {
    setMobileOpen(false);
    document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const closeMobile = () => setMobileOpen(false);

  return (
    <Fragment>
      <header className="sticky top-0 z-50 w-full border-b border-[#2C2C2C]/10 bg-[#FAF8F4]/95 backdrop-blur-sm">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-4 md:gap-3">
          <div className="flex items-center gap-2 justify-self-start">
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="rounded-lg p-2 text-[#2C2C2C]/80 ring-1 ring-black/5 transition hover:bg-white sm:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <DormspaceWelcomeLogo href="/dormspaces" />
          </div>

          <nav className="hidden items-center justify-center gap-6 sm:flex">
            <button type="button" onClick={scrollToListings} className={NAV_LINK}>
              Find a Dorm
            </button>
            <PublicResourcesMenu />
          </nav>

          <div className="flex items-center gap-2 justify-self-end">
            {loading ? (
              <div className="h-9 w-24 animate-pulse rounded-full bg-black/5" />
            ) : user ? (
              <>
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
                        <div className="my-1.5 h-px bg-[#2C2C2C]/10" />
                        {isLandlord ? (
                          <>
                            <Link
                              href="/dormspaces/dashboard"
                              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                              onClick={() => setAccountOpen(false)}
                            >
                              <Home className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                              My Listings
                            </Link>
                            <Link
                              href="/dormspaces/dashboard?tab=account"
                              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                              onClick={() => setAccountOpen(false)}
                            >
                              <User className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                              My Profile
                            </Link>
                          </>
                        ) : null}
                        <Link
                          href="/"
                          className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/85 hover:bg-[#FAF8F4]"
                          onClick={() => setAccountOpen(false)}
                        >
                          <Home className="h-4 w-4 shrink-0 text-[#6B9E6E]" aria-hidden />
                          Go to BahayGo
                        </Link>
                        <div className="my-1.5 h-px bg-[#2C2C2C]/10" />
                        <button
                          type="button"
                          onClick={() => void signOut()}
                          disabled={signOutBusy}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          <LogOut className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                          {signOutBusy ? "…" : "Log out"}
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/dormspaces/welcome"
                  className="hidden h-9 items-center justify-center rounded-xl border-2 border-[#2C2C2C]/15 bg-white px-3 text-sm font-bold text-[#2C2C2C] transition hover:border-[#6B9E6E]/40 sm:inline-flex"
                >
                  List Your Space
                </Link>
                <Link
                  href="/dormspaces/welcome?tab=signin"
                  className="hidden text-sm font-semibold text-[#404040] transition hover:text-[#2C2C2C] sm:inline"
                >
                  Sign In
                </Link>
                <Link
                  href="/dormspaces/welcome?tab=signup"
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-[#6B9E6E] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#5d8a60]"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div
          className="sm:hidden"
          style={{ position: "fixed", inset: 0, zIndex: 9999 }}
          onClick={closeMobile}
          role="presentation"
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
              boxShadow: "4px 0 24px rgba(0,0,0,0.12)",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#2C2C2C]/10 px-4 py-4">
              <DormspaceWelcomeLogo href="/dormspaces" />
              <button type="button" onClick={closeMobile} className="rounded-lg p-2" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-3 py-4">
              <button
                type="button"
                onClick={scrollToListings}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#404040] hover:bg-[#FAF8F4]"
              >
                Find a Dorm
              </button>
              <Link href="#" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#404040] hover:bg-[#FAF8F4]">
                How verification works
              </Link>
              <Link href="#" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#404040] hover:bg-[#FAF8F4]">
                Tips for landlords
              </Link>
              <Link href="#" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#404040] hover:bg-[#FAF8F4]">
                Tips for tenants
              </Link>
              <div className="my-2 h-px bg-[#2C2C2C]/10" />
              {user ? (
                <>
                  {isLandlord ? (
                    <>
                      <Link href="/dormspaces/submit?from=welcome" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm font-bold text-[#6B9E6E]">
                        List Your Space
                      </Link>
                      <Link href="/dormspaces/dashboard" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#404040]">
                        My Listings
                      </Link>
                    </>
                  ) : null}
                  <Link href="/" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#404040]">
                    Go to BahayGo
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      closeMobile();
                      void signOut();
                    }}
                    className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-600"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/dormspaces/welcome" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#404040]">
                    List Your Space
                  </Link>
                  <Link href="/dormspaces/welcome?tab=signin" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-[#404040]">
                    Sign In
                  </Link>
                  <Link
                    href="/dormspaces/welcome?tab=signup"
                    onClick={closeMobile}
                    className="mt-1 rounded-xl bg-[#6B9E6E] px-3 py-2.5 text-center text-sm font-bold text-white"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      ) : null}
    </Fragment>
  );
}

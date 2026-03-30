"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, LogOut, LayoutDashboard, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
    .slice(0, 2);
  const raw = parts.map((p) => p[0]).join("");
  return raw.toUpperCase() || "U";
}

function initialsFromUser(user: { email?: string | null } | null): string {
  const email = user?.email ?? "";
  const first = email.trim()[0] ?? "U";
  return first.toUpperCase();
}

export function MaddenTopNav() {
  const { user, profile, loading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [busy, setBusy] = useState(false);

  const initials = useMemo(() => {
    if (profile?.full_name?.trim()) return initialsFromName(profile.full_name);
    return initialsFromUser(user);
  }, [profile?.full_name, user]);

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#2C2C2C]/8 bg-[#FAF8F4]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-serif text-lg font-bold tracking-tight text-[#2C2C2C]">
            Fishnet
          </span>
          <span className="text-[11px] font-semibold tracking-[0.16em] text-[#2C2C2C]/45">
            Residences
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-full bg-black/5" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2.5 py-1.5 shadow-sm hover:bg-white/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
                  aria-label="Account menu"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#7C9A7E] text-xs font-bold text-white">
                    {initials}
                  </span>
                  <span className="hidden text-sm font-semibold text-[#2C2C2C]/70 sm:block">
                    {profile?.full_name?.trim() ? profile.full_name.split(/\s+/g)[0] : "Account"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-[#2C2C2C]/45" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#2C2C2C]/70">
                      Signed in
                    </span>
                    <span className="text-xs text-[#2C2C2C]/50">
                      {user.email ?? ""}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    void logout();
                  }}
                  disabled={busy}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  {busy ? "Logging out…" : "Logout"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-full bg-[#2C2C2C] px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#7C9A7E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#C9A84C]/35"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}


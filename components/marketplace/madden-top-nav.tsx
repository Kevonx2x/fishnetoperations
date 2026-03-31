"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function MaddenTopNav() {
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

  return (
    <header className="sticky top-0 z-40 border-b border-[#2C2C2C]/10 bg-[#FAF8F4]/92 backdrop-blur-md">
      <div className="mx-auto grid max-w-6xl grid-cols-3 items-center px-4 py-3">
        <Link href="/" className="justify-self-start font-serif text-lg font-bold text-[#2C2C2C]">
          Madden Real Estate
        </Link>

        <nav className="hidden justify-self-center sm:flex items-center gap-7 text-sm font-medium text-[#2C2C2C]/70">
          <Link href="/" className="hover:text-[#2C2C2C]">Home</Link>
          <Link href="/properties" className="hover:text-[#2C2C2C]">Properties</Link>
          <Link href="/blog" className="hover:text-[#2C2C2C]">Blog</Link>
          <Link href="/contact" className="hover:text-[#2C2C2C]">Contact</Link>
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


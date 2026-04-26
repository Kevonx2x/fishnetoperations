"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClientMobileBottomNav } from "@/components/client/client-mobile-bottom-nav";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { ClientNotificationsPanel } from "@/components/notifications/client-notifications-panel";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function NotificationsPage() {
  const pathname = usePathname();
  const { user, profile, role, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [bottomNavUnread, setBottomNavUnread] = useState(0);

  const refreshBottomNavUnread = useCallback(async () => {
    if (!user?.id) {
      setBottomNavUnread(0);
      return;
    }
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    setBottomNavUnread(count ?? 0);
  }, [user?.id, supabase]);

  useEffect(() => {
    void refreshBottomNavUnread();
  }, [refreshBottomNavUnread]);

  useEffect(() => {
    const onRead = () => void refreshBottomNavUnread();
    window.addEventListener("bahaygo:notifications-read", onRead);
    return () => window.removeEventListener("bahaygo:notifications-read", onRead);
  }, [refreshBottomNavUnread]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white">
        <MaddenTopNav />
        <div className="flex min-h-[40vh] items-center justify-center text-sm font-semibold text-[#2C2C2C]/50">
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <MaddenTopNav />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-sm font-semibold text-[#2C2C2C]/50">Sign in to see notifications.</p>
          <Link
            href="/auth/login?next=/notifications"
            className="mt-4 inline-flex rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5d8a60]"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const showClientMobileNav = role === "client" && user?.id;

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <MaddenTopNav />
      <main
        className={`mx-auto max-w-2xl px-4 py-8 sm:py-10${showClientMobileNav ? " pb-28" : ""}`}
      >
        <ClientNotificationsPanel />
      </main>
      {showClientMobileNav ? (
        <ClientMobileBottomNav
          pathname={pathname}
          userId={user.id}
          avatarUrl={profile?.avatar_url?.trim() || null}
          fullName={profile?.full_name?.trim() ?? ""}
          unreadCount={bottomNavUnread}
        />
      ) : null}
    </div>
  );
}

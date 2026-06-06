"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClientMobileBottomNav } from "@/components/client/client-mobile-bottom-nav";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { LoggedOutTabEmptyState } from "@/components/marketplace/logged-out-tab-empty-state";
import { ClientNotificationsPanel } from "@/components/notifications/client-notifications-panel";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function NotificationsPage() {
  const pathname = usePathname();
  const { user, profile, role, loading: authLoading, status } = useAuth();
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

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <MaddenTopNav />
        <LoggedOutTabEmptyState
          title="Notifications"
          copy="Sign in to see your notifications."
          nextPath="/notifications"
        />
      </div>
    );
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <MaddenTopNav />
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

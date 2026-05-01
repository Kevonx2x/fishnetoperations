"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import type { ProfileRole } from "@/lib/auth-roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  role: ProfileRole;
  onboarding_completed: boolean;
  created_at?: string | null;
  tutorial_completed?: boolean | null;
  tutorial_dismissed_at?: string | null;
  /** Changelog version acknowledged in post-login modal (e.g. v1.0). */
  last_seen_changelog?: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  role: ProfileRole | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeRole(r: string | null | undefined): ProfileRole {
  if (
    r === "admin" ||
    r === "ops_admin" ||
    r === "broker" ||
    r === "agent" ||
    r === "client" ||
    r === "team_member"
  ) {
    return r;
  }
  return "client";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // Only force-signout on the known stale refresh-token case.
      const msg = String((error as { message?: unknown } | null)?.message ?? "");
      if (msg.toLowerCase().includes("invalid refresh token")) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
      }
      setProfile(null);
      setUser(null);
      setLoading(false);
      return;
    }
    const u = data.user ?? null;
    setUser(u);
    if (!u) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data: p } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, phone, bio, role, onboarding_completed, created_at, tutorial_completed, tutorial_dismissed_at, last_seen_changelog",
      )
      .eq("id", u.id)
      .maybeSingle();
    if (p) {
      const row = p as {
        created_at?: string | null;
        tutorial_completed?: boolean | null;
        tutorial_dismissed_at?: string | null;
        last_seen_changelog?: string | null;
      };
      setProfile({
        id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        phone: (p as { phone?: string | null }).phone ?? null,
        bio: (p as { bio?: string | null }).bio ?? null,
        role: normalizeRole(p.role),
        onboarding_completed: Boolean((p as { onboarding_completed?: unknown }).onboarding_completed),
        created_at: row.created_at ?? null,
        tutorial_completed: row.tutorial_completed ?? null,
        tutorial_dismissed_at: row.tutorial_dismissed_at ?? null,
        last_seen_changelog: row.last_seen_changelog ?? null,
      });
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshProfile();
    });
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshProfile();
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      refreshProfile,
    }),
    [user, profile, loading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

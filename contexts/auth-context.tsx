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
  role: ProfileRole;
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
  if (r === "admin" || r === "broker" || r === "agent" || r === "client") {
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
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    setUser(u ?? null);
    if (!u) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const { data: p } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .eq("id", u.id)
      .maybeSingle();
    if (p) {
      setProfile({
        id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        role: normalizeRole(p.role),
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

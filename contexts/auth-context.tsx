"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { ProfileRole } from "@/lib/auth-roles";
import {
  normalizeLandlordVerificationStatus,
  type LandlordVerificationStatus,
} from "@/lib/landlord-verification";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  role: ProfileRole;
  is_landlord: boolean;
  onboarding_completed: boolean;
  created_at?: string | null;
  tutorial_completed?: boolean | null;
  tutorial_dismissed_at?: string | null;
  /** Changelog version acknowledged in post-login modal (e.g. v1.0). */
  last_seen_changelog?: string | null;
  landlord_verification_status: LandlordVerificationStatus;
  landlord_verification_rejection_reason: string | null;
  landlord_verification_submitted_at: string | null;
};

/** Session resolution state — never treat `loading` as logged out. */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  role: ProfileRole | null;
  /** True while `status === "loading"`. */
  loading: boolean;
  status: AuthStatus;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROFILE_SELECT =
  "id, full_name, avatar_url, phone, bio, role, is_landlord, onboarding_completed, created_at, tutorial_completed, tutorial_dismissed_at, last_seen_changelog, landlord_verification_status, landlord_verification_rejection_reason, landlord_verification_submitted_at";

const AUTH_RESOLVE_TIMEOUT_MS = 10_000;

function normalizeRole(r: string | null | undefined): ProfileRole {
  if (
    r === "admin" ||
    r === "ops_admin" ||
    r === "broker" ||
    r === "agent" ||
    r === "client" ||
    r === "team_member" ||
    r === "landlord"
  ) {
    return r;
  }
  return "client";
}

function profileFromRow(p: Record<string, unknown>): Profile {
  const row = p as {
    created_at?: string | null;
    tutorial_completed?: boolean | null;
    tutorial_dismissed_at?: string | null;
    last_seen_changelog?: string | null;
  };
  return {
    id: p.id as string,
    full_name: (p.full_name as string | null) ?? null,
    avatar_url: (p.avatar_url as string | null) ?? null,
    phone: (p.phone as string | null | undefined) ?? null,
    bio: (p.bio as string | null | undefined) ?? null,
    role: normalizeRole(p.role as string | null | undefined),
    is_landlord: (p as { is_landlord?: boolean | null }).is_landlord === true,
    onboarding_completed: Boolean((p as { onboarding_completed?: unknown }).onboarding_completed),
    created_at: row.created_at ?? null,
    tutorial_completed: row.tutorial_completed ?? null,
    tutorial_dismissed_at: row.tutorial_dismissed_at ?? null,
    last_seen_changelog: row.last_seen_changelog ?? null,
    landlord_verification_status: normalizeLandlordVerificationStatus(
      (p as { landlord_verification_status?: string | null }).landlord_verification_status,
    ),
    landlord_verification_rejection_reason:
      (p as { landlord_verification_rejection_reason?: string | null })
        .landlord_verification_rejection_reason ?? null,
    landlord_verification_submitted_at:
      (p as { landlord_verification_submitted_at?: string | null })
        .landlord_verification_submitted_at ?? null,
  };
}

function isInvalidRefreshTokenError(message: string): boolean {
  return message.toLowerCase().includes("invalid refresh token");
}

function isLikelyNetworkAuthError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("fetch") ||
    m.includes("network") ||
    m.includes("timeout") ||
    m.includes("failed to fetch") ||
    m.includes("load failed")
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const userRef = useRef<User | null>(null);
  const statusRef = useRef<AuthStatus>("loading");
  const resolveGenerationRef = useRef(0);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const loadProfileForUser = useCallback(
    async (u: User): Promise<Profile | null> => {
      const { data: p } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", u.id).maybeSingle();
      return p ? profileFromRow(p as Record<string, unknown>) : null;
    },
    [supabase],
  );

  const applyAuthenticated = useCallback((u: User, p: Profile | null) => {
    userRef.current = u;
    setUser(u);
    setProfile(p);
    setStatus("authenticated");
  }, []);

  const applyUnauthenticated = useCallback(() => {
    userRef.current = null;
    setUser(null);
    setProfile(null);
    setStatus("unauthenticated");
  }, []);

  const resolveAuth = useCallback(
    async (options?: { resume?: boolean }) => {
      const generation = ++resolveGenerationRef.current;
      const resume = options?.resume === true;
      const hadUser = userRef.current != null;

      if (!resume) {
        setStatus("loading");
      }

      const finishIfCurrent = () => generation === resolveGenerationRef.current;

      // Prefer getSession (local persisted storage) before network getUser().
      const { data: sessionData } = await supabase.auth.getSession();
      if (!finishIfCurrent()) return;

      const sessionUser = sessionData.session?.user ?? null;
      if (sessionUser) {
        const p = await loadProfileForUser(sessionUser);
        if (!finishIfCurrent()) return;
        applyAuthenticated(sessionUser, p);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!finishIfCurrent()) return;

      if (userData.user) {
        const p = await loadProfileForUser(userData.user);
        if (!finishIfCurrent()) return;
        applyAuthenticated(userData.user, p);
        return;
      }

      if (userError) {
        const msg = String(userError.message ?? "");
        if (isInvalidRefreshTokenError(msg)) {
          try {
            await supabase.auth.signOut();
          } catch {
            /* ignore */
          }
          if (!finishIfCurrent()) return;
          applyUnauthenticated();
          return;
        }

        // Transient network failure on resume — keep the last known signed-in view.
        if (resume && hadUser && isLikelyNetworkAuthError(msg)) {
          setStatus("authenticated");
          return;
        }
      }

      if (resume && hadUser) {
        // Session missing from storage but we had a user — retry once (PWA storage wake-up).
        await new Promise((r) => setTimeout(r, 150));
        if (!finishIfCurrent()) return;
        const retry = await supabase.auth.getSession();
        if (!finishIfCurrent()) return;
        const retryUser = retry.data.session?.user ?? null;
        if (retryUser) {
          const p = await loadProfileForUser(retryUser);
          if (!finishIfCurrent()) return;
          applyAuthenticated(retryUser, p);
          return;
        }
      }

      applyUnauthenticated();
    },
    [applyAuthenticated, applyUnauthenticated, loadProfileForUser, supabase],
  );

  const syncFromSession = useCallback(
    async (session: Session | null) => {
      const u = session?.user ?? null;
      if (!u) {
        applyUnauthenticated();
        return;
      }
      const p = await loadProfileForUser(u);
      applyAuthenticated(u, p);
    },
    [applyAuthenticated, applyUnauthenticated, loadProfileForUser],
  );

  const refreshProfile = useCallback(async () => {
    await resolveAuth({ resume: userRef.current != null });
  }, [resolveAuth]);

  useEffect(() => {
    void resolveAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Initial hydration is handled by resolveAuth() — avoid racing to unauthenticated.
      if (event === "INITIAL_SESSION") return;
      if (event === "SIGNED_OUT") {
        applyUnauthenticated();
        return;
      }
      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED" ||
        event === "PASSWORD_RECOVERY"
      ) {
        void syncFromSession(session);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [applyUnauthenticated, resolveAuth, supabase, syncFromSession]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        void resolveAuth({ resume: true });
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void resolveAuth({ resume: true });
      }
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [resolveAuth]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (statusRef.current !== "loading") return;
      void resolveAuth({ resume: userRef.current != null });
    }, AUTH_RESOLVE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [resolveAuth]);

  const loading = status === "loading";

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      status,
      refreshProfile,
    }),
    [user, profile, loading, status, refreshProfile],
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

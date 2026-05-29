"use client";

import { useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthGoogleDivider,
  ContinueWithGoogleButton,
} from "@/components/auth/continue-with-google-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthSignInButton } from "@/components/auth/auth-sign-in-cta";
import { pathForRole } from "@/lib/auth-roles";
import { isSafeAuthNext } from "@/lib/auth-login-path";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const FIELD =
  "mt-1 w-full min-h-11 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? searchParams.get("redirect");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const oauthFailed = searchParams.get("error") === "oauth_failed";
  const showOauthError = oauthFailed && !error;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data: authData, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, tutorial_completed")
        .eq("id", authData.user.id)
        .maybeSingle();

      const role = profile?.role;
      const tutorialCompleted = (profile as { tutorial_completed?: boolean | null } | null)?.tutorial_completed;
      if (next === "back") {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.replace("/");
        }
        router.refresh();
      } else if (isSafeAuthNext(next)) {
        router.replace(next);
        router.refresh();
      } else {
        let dest: string;
        if (role === "agent") {
          if (tutorialCompleted === false) {
            const { data: ag } = await supabase
              .from("agents")
              .select("verification_status")
              .eq("user_id", authData.user.id)
              .maybeSingle();
            dest =
              ag?.verification_status === "verified" ? "/" : "/dashboard/agent?tab=pipeline";
          } else {
            dest = "/dashboard/agent?tab=pipeline";
          }
        } else if (role === "client") {
          dest = "/";
        } else if (role === "landlord") {
          dest = "/dormspaces/dashboard";
        } else if (role === "admin" || role === "ops_admin" || role === "broker") {
          dest = pathForRole(role);
        } else {
          dest = "/?welcome=true";
        }
        router.replace(dest);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    }
    setBusy(false);
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your email and password to access your account."
      staticBahayGoLogo
      compactMobile
    >
      <ContinueWithGoogleButton onError={setError} />
      <AuthGoogleDivider compact />
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-[11px] font-medium uppercase tracking-wide text-[#525252]">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </label>
        <label className="block text-[11px] font-medium uppercase tracking-wide text-[#525252]">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD}
          />
        </label>
        <div>
          <Link
            href="/auth/forgot-password"
            className="text-[13px] font-semibold text-[#6B9E6E] hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        {(error || showOauthError) && (
          <p className="text-sm text-red-600">
            {error ||
              (showOauthError ? "Google sign-in could not be completed. Please try again." : "")}
          </p>
        )}
        <AuthSignInButton disabled={busy}>{busy ? "Signing in…" : "Sign in"}</AuthSignInButton>
      </form>
      <p className="mt-3 text-center text-[13px] text-[#484848]">
        No account?{" "}
        <Link href="/auth/signup" className="font-medium text-[#2C2C2C] underline">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Sign in" subtitle="Loading…" staticBahayGoLogo compactMobile>
          <div />
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

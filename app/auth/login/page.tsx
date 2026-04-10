"use client";

import { useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { pathForRole } from "@/lib/auth-roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();

      const role = profile?.role;
      if (next === "back") {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.replace("/");
        }
        router.refresh();
      } else if (next && next.startsWith("/") && !next.startsWith("//")) {
        router.replace(next);
        router.refresh();
      } else {
        let dest: string;
        if (role === "agent") {
          dest = "/dashboard/agent";
        } else if (role === "client") {
          dest = "/";
        } else if (role === "admin" || role === "broker") {
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
      largeLogo
      staticBahayGoLogo
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
          />
        </label>
        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        <Link href="/auth/forgot-password" className="underline hover:text-gray-800">
          Forgot password?
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-gray-500">
        No account?{" "}
        <Link href="/?onboarding=true" className="font-medium text-gray-900 underline">
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
        <AuthShell title="Sign in" subtitle="Loading…" staticBahayGoLogo>
          <div />
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

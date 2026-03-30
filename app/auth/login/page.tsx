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
      const dest =
        next && next.startsWith("/") && !next.startsWith("//")
          ? next
          : pathForRole(
              role === "admin" || role === "broker" || role === "agent" || role === "client"
                ? role
                : "client",
            );
      router.replace(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    }
    setBusy(false);
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use your email and password to access your account."
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
        <Link href="/auth/signup" className="font-medium text-gray-900 underline">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell title="Sign in" subtitle="Loading…"><div /></AuthShell>}>
      <LoginForm />
    </Suspense>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            name: fullName.trim(),
          },
        },
      });
      if (err) throw err;
      if (data.user && !data.session) {
        setNotice(
          "Check your email to confirm your account, then sign in.",
        );
        setBusy(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign up");
    }
    setBusy(false);
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Register as a client to save searches and work with agents."
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
          Full name
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
          />
        </label>
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
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
          />
        </label>
        {notice && (
          <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">{notice}</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-medium text-gray-900 underline">
          Sign in
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-gray-400">
        Brokers and agents: use the registration flows after signing in from{" "}
        <Link href="/register/broker" className="underline">
          broker
        </Link>{" "}
        or{" "}
        <Link href="/register/agent" className="underline">
          agent
        </Link>{" "}
        pages.
      </p>
    </AuthShell>
  );
}

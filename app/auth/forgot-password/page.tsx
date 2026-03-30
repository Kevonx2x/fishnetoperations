"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${origin}/auth/reset-password` },
      );
      if (err) throw err;
      setMessage(
        "If an account exists for that email, we sent a link to reset your password.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
    setBusy(false);
  };

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We will email you a link to choose a new password."
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
        {message && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message}</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        <Link href="/auth/login" className="underline hover:text-gray-800">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

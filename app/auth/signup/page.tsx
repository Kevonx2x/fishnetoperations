"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function isDuplicateSignupError(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "";
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const lower = msg.toLowerCase();
  return (
    code === "user_already_exists" ||
    lower.includes("user_already_exists") ||
    lower.includes("already registered") ||
    lower.includes("already exists") ||
    lower.includes("email address is already")
  );
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setInterval(() => {
      setResendCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendCooldown]);

  const handleResend = async () => {
    const trimmed = email.trim();
    if (!trimmed || resendCooldown > 0) return;
    setResendCooldown(60);
    const { error: resendErr } = await supabase.auth.resend({
      type: "signup",
      email: trimmed,
    });
    if (resendErr) {
      toast.error(resendErr.message);
      setResendCooldown(0);
      return;
    }
    toast.success("Email resent! Check your inbox and spam.");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setDuplicateEmail(false);
    setBusy(true);
    try {
      // Helpful, explicit client-side config validation (avoids vague "Failed to fetch").
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) {
        throw new Error(
          "Client Supabase env is missing. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set and restart the dev server.",
        );
      }
      const fn = firstName.trim();
      const ln = lastName.trim();
      if (!fn || !ln) {
        setError("Please enter both first and last name.");
        setBusy(false);
        return;
      }
      const fullNameCombined = `${fn} ${ln}`;
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: fn,
            last_name: ln,
            full_name: fullNameCombined,
            name: fullNameCombined,
          },
        },
      });
      if (err) {
        if (isDuplicateSignupError(err)) {
          setDuplicateEmail(true);
          setBusy(false);
          return;
        }
        throw err;
      }
      if (data.user && !data.session) {
        setNotice(
          "Check your email to confirm your account, then sign in.",
        );
        setBusy(false);
        return;
      }
      if (data.session?.access_token) {
        try {
          await fetch("/api/v1/notify/admin-new-client", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${data.session.access_token}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          });
        } catch {
          /* admin SMS is best-effort */
        }
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      console.error("[signup] signUp failed:", err);
      if (isDuplicateSignupError(err)) {
        setDuplicateEmail(true);
        setBusy(false);
        return;
      }
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Could not sign up";
      if (/failed to fetch/i.test(message)) {
        setError(
          `${message}\n\nThis usually means NEXT_PUBLIC_SUPABASE_URL is unreachable from the browser (wrong URL, blocked network/CORS, or missing env). Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY and restart the dev server.`,
        );
      } else {
        setError(message);
      }
    }
    setBusy(false);
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Register as a client to save searches and work with agents."
      largeLogo
      staticBahayGoLogo
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
            First name
            <input
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
            />
          </label>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
            Last name
            <input
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
            />
          </label>
        </div>
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
        {duplicateEmail && (
          <div className="mt-2 text-sm text-red-500">
            <p>An account with this email already exists. Please sign in instead.</p>
            <Link href="/auth/login" className="mt-1 inline-block font-medium underline">
              Sign in →
            </Link>
          </div>
        )}
        {notice && (
          <div className="space-y-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <p>{notice}</p>
            <p className="text-blue-900/90">
              Didn&apos;t receive it? Check your spam folder or{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="font-medium text-blue-900 underline underline-offset-2 hover:text-blue-950 disabled:cursor-not-allowed disabled:opacity-50"
              >
                resend the email
              </button>
              {resendCooldown > 0 ? (
                <span className="text-blue-800/90">
                  {" "}
                  Resend again in {resendCooldown}s…
                </span>
              ) : null}
            </p>
          </div>
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

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  AuthGoogleDivider,
  ContinueWithGoogleButton,
} from "@/components/auth/continue-with-google-button";
import {
  isDormspaceSubmitBlockedRole,
  isLandlordCapable,
  pathForRole,
  roleDisplayLabel,
} from "@/lib/auth-roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const FIELD =
  "mt-1.5 w-full rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#888888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

type AuthStage = "email" | "signin" | "create";

function isDuplicateSignupError(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: string }).code ?? "")
      : "";
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const lower = msg.toLowerCase();
  return (
    code === "user_already_exists" ||
    lower.includes("already registered") ||
    lower.includes("already exists") ||
    lower.includes("email address is already")
  );
}

function staffSignInBlockedMessage(role: string | null | undefined): string {
  const label = roleDisplayLabel(role);
  const article = label === "agent" ? "an" : "a";
  return `This account is registered as ${article} ${label} on BahayGo. Sign out and use a different email to create a landlord account, or go to your ${label} dashboard.`;
}

function EmailReadonlyHeader({
  email,
  onUseDifferentEmail,
}: {
  email: string;
  onUseDifferentEmail: () => void;
}) {
  return (
    <p className="text-sm font-medium text-[#484848]">
      <span className="font-semibold text-[#2C2C2C]">{email}</span>
      <span className="text-[#888888]">{" \u00b7 "}</span>
      <button
        type="button"
        onClick={onUseDifferentEmail}
        className="font-semibold text-[#6B9E6E] hover:underline"
      >
        use a different email
      </button>
    </p>
  );
}

export function StaffRoleNoticeCard({
  role,
  onSignOut,
  signingOut,
}: {
  role: string | null | undefined;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const dashboardHref = pathForRole(role);
  const label = roleDisplayLabel(role);

  return (
    <div className="rounded-2xl border border-amber-400/40 bg-white p-6 shadow-[0_4px_24px_rgba(44,44,44,0.06)] sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a6d32]">
        {"You're signed in as "}
        {label}
      </p>
      <p className="mt-3 text-sm font-medium leading-relaxed text-[#484848]">
        {"Agents and brokers can't list dormspaces under their existing BahayGo account. To list a "}
        {"dormspace, please sign out and create a separate landlord account using a different email."}
      </p>
      <button
        type="button"
        onClick={onSignOut}
        disabled={signingOut}
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] disabled:opacity-60"
      >
        {signingOut ? "Signing out\u2026" : "Sign out and continue"}
      </button>
      <p className="mt-4 text-center">
        <Link
          href={dashboardHref}
          className="text-sm font-semibold text-[#6B9E6E] hover:underline"
        >
          Go to my {label} dashboard
        </Link>
      </p>
    </div>
  );
}

export function ClientSignedInCard() {
  return (
    <div className="rounded-2xl border border-[#DDDDDD] bg-white p-6 shadow-[0_4px_24px_rgba(44,44,44,0.06)] sm:p-8">
      <p className="font-serif text-xl font-bold text-[#2C2C2C]">Ready to list your space?</p>
      <p className="mt-2 text-sm font-medium leading-relaxed text-[#484848]">
        {"You're signed in. Browse dormspaces or start a listing when you're ready \u2014 your client account stays the same."}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link
          href="/dormspaces/submit?from=welcome"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
        >
          List your property
        </Link>
        <Link
          href="/dormspaces"
          className="inline-flex h-10 items-center justify-center text-sm font-semibold text-[#6B9E6E] hover:underline"
        >
          Browse dormspaces
        </Link>
      </div>
    </div>
  );
}

export function EmailFirstAuthCard() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [stage, setStage] = useState<AuthStage>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const resetToEmail = () => {
    setStage("email");
    setPassword("");
    setFirstName("");
    setLastName("");
    setError("");
  };

  const handleContinueEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Enter your email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dormspaces/welcome/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const json = (await res.json()) as { data?: { exists?: boolean }; error?: { message?: string } };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not check email");
        return;
      }
      setEmail(trimmedEmail);
      setStage(json.data?.exists ? "signin" : "create");
    } catch {
      setError("Could not check email. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    try {
      const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInErr) {
        setError("Could not sign in. Check your email and password.");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("role, is_landlord")
        .eq("id", authData.user.id)
        .maybeSingle();

      const role = prof?.role ?? null;
      const is_landlord = prof?.is_landlord === true;

      if (isDormspaceSubmitBlockedRole(role)) {
        await supabase.auth.signOut();
        setError(staffSignInBlockedMessage(role));
        return;
      }

      if (isLandlordCapable({ role, is_landlord })) {
        router.replace("/dormspaces/dashboard");
        router.refresh();
        return;
      }

      router.replace("/dormspaces");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim().toLowerCase();
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      setError("Enter your first and last name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dormspaces/welcome/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          first_name: fn,
          last_name: ln,
        }),
      });
      const json = (await res.json()) as { error?: { message?: string; code?: string } };
      if (!res.ok) {
        if (json.error?.code === "EMAIL_EXISTS") {
          setStage("signin");
        }
        setError(json.error?.message ?? "Could not create account");
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInErr) {
        setError("Account created but sign-in failed. Try signing in.");
        setStage("signin");
        return;
      }

      router.replace("/dormspaces");
      router.refresh();
    } catch (err) {
      if (isDuplicateSignupError(err)) {
        setError("An account with this email already exists. Sign in instead.");
        setStage("signin");
        return;
      }
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#DDDDDD] bg-white p-6 shadow-[0_4px_24px_rgba(44,44,44,0.06)] sm:p-8">
      {stage === "email" ? (
        <>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">
            Get started or sign in
          </h2>
          <p className="mt-2 text-sm font-medium text-[#484848]">
            {"We'll detect your account or help you create one"}
          </p>

          <div className="mt-6">
            <ContinueWithGoogleButton
              variant="sage-outline"
              onError={setError}
              callbackPath="/auth/callback?context=landlord"
            />
            <AuthGoogleDivider />
          </div>

          <form onSubmit={(e) => void handleContinueEmail(e)} className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={FIELD}
              />
            </label>
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#6B9E6E] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Checking\u2026" : "Continue"}
            </button>
          </form>
        </>
      ) : null}

      {stage === "signin" ? (
        <>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">
            Welcome back, sign in to continue
          </h2>
          <div className="mt-3">
            <EmailReadonlyHeader email={email} onUseDifferentEmail={resetToEmail} />
          </div>
          <form onSubmit={(e) => void handleSignIn(e)} className="mt-6 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
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
            <div className="-mt-1">
              <Link
                href="/auth/forgot-password"
                className="text-sm font-semibold text-[#6B9E6E] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#6B9E6E] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Signing in\u2026" : "Sign in"}
            </button>
          </form>
        </>
      ) : null}

      {stage === "create" ? (
        <>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C]">
            Create your account
          </h2>
          <div className="mt-3">
            <EmailReadonlyHeader email={email} onUseDifferentEmail={resetToEmail} />
          </div>
          <form onSubmit={(e) => void handleCreate(e)} className="mt-6 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
              First name
              <input
                type="text"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={FIELD}
                maxLength={100}
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
              Last name
              <input
                type="text"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={FIELD}
                maxLength={100}
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
              Password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={FIELD}
              />
            </label>
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#6B9E6E] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Creating account\u2026" : "Create my account"}
            </button>
            <p className="text-center text-xs font-medium leading-relaxed text-[#888888]">
              {
                "By creating an account, you can save dormspaces, contact landlords, and list your own space when you're ready."
              }
            </p>
          </form>
        </>
      ) : null}
    </div>
  );
}

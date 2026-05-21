"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BadgeCheck, MapPin, Plus, Sparkles, Wifi } from "lucide-react";
import { toast } from "sonner";

import {
  AuthGoogleDivider,
  ContinueWithGoogleButton,
} from "@/components/auth/continue-with-google-button";
import { DormspaceLandlordVerificationBanner } from "@/components/dormspaces/dormspace-landlord-verification-banner";
import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import {
  isVerifiedLandlordProfile,
  normalizeLandlordVerificationStatus,
} from "@/lib/landlord-verification";
import { useAuth } from "@/contexts/auth-context";
import {
  isDormspaceSubmitBlockedRole,
  isLandlordCapable,
  roleDisplayLabel,
} from "@/lib/auth-roles";
import { DORMSPACE_HERO_IMAGE } from "@/lib/dormspaces";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthTab = "create" | "signin";

const FIELD =
  "mt-1.5 w-full rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#888888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const PREVIEW_LISTINGS = [
  {
    title: "Bright bedspace near Taft",
    area: "Malate, Manila",
    price: "₱4,200",
    tag: "ID verified",
  },
  {
    title: "Quiet shared room · BGC",
    area: "Taguig",
    price: "₱5,800",
    tag: "WiFi included",
  },
  {
    title: "Student-friendly dorm · QC",
    area: "Quezon City",
    price: "₱3,500",
    tag: "No listing fees",
  },
];

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

function LandlordWelcomeCard({
  firstName,
  listingCount,
  verificationStatus,
  rejectionReason,
}: {
  firstName: string;
  listingCount: number | null;
  verificationStatus: ReturnType<typeof normalizeLandlordVerificationStatus>;
  rejectionReason?: string | null;
}) {
  const hasListings = listingCount != null && listingCount > 0;
  const verified = isVerifiedLandlordProfile(verificationStatus);

  return (
    <div className="rounded-2xl border border-[#DDDDDD] bg-white p-6 shadow-[0_8px_32px_rgba(44,44,44,0.08)] sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6B9E6E]">Landlord account</p>
      <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-[1.65rem]">
        Welcome back, {firstName}
      </h2>
      <p className="mt-2 text-sm font-medium leading-relaxed text-[#484848]">
        {listingCount === null
          ? "Loading your listings…"
          : hasListings
            ? `You have ${listingCount} listing${listingCount === 1 ? "" : "s"} in your dashboard.`
            : "You don't have any listings yet. Add your first dormspace to reach students and young professionals."}
      </p>

      {verificationStatus !== "approved" ? (
        <DormspaceLandlordVerificationBanner
          status={verificationStatus}
          rejectionReason={rejectionReason}
          variant="submit"
          className="mt-4"
        />
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {hasListings ? (
          <>
            <Link
              href="/dormspaces/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
            >
              Go to my landlord dashboard
            </Link>
            <Link
              href="/dormspaces/submit?from=welcome"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#2C2C2C]/12 bg-white px-6 text-sm font-bold text-[#2C2C2C] transition hover:border-[#6B9E6E]/35 hover:bg-[#FAF8F4]"
            >
              <Plus className="size-4 text-[#6B9E6E]" aria-hidden />
              Add another dormspace
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/dormspaces/submit?from=welcome"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
            >
              <Plus className="size-4" aria-hidden />
              Add your first dormspace
            </Link>
            <Link
              href="/dormspaces/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-[#2C2C2C]/12 bg-white px-6 text-sm font-bold text-[#2C2C2C] transition hover:border-[#6B9E6E]/35 hover:bg-[#FAF8F4]"
            >
              Go to my landlord dashboard
            </Link>
          </>
        )}
        <Link
          href="/dormspaces"
          className="inline-flex h-10 items-center justify-center text-sm font-semibold text-[#6B9E6E] hover:underline"
        >
          Browse dormspaces as a tenant
        </Link>
      </div>

      {verified ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[#4a7a4d]">
          <BadgeCheck className="size-3.5 shrink-0 text-[#6B9E6E]" aria-hidden />
          Verified landlord — ID checked once, not per listing
        </p>
      ) : null}
    </div>
  );
}

function landlordFirstName(fullName: string | null | undefined, email: string | undefined): string {
  const t = fullName?.trim() ?? "";
  if (t) {
    const space = t.indexOf(" ");
    return space === -1 ? t : t.slice(0, space);
  }
  return email?.split("@")[0] ?? "there";
}

export function DormspaceWelcome() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile, loading: authLoading } = useAuth();

  const isLandlordSignedIn = Boolean(user && profile && isLandlordCapable(profile));
  const isStaffSignedIn = Boolean(
    user && profile?.role && isDormspaceSubmitBlockedRole(profile.role),
  );

  const [listingCount, setListingCount] = useState<number | null>(null);
  const [tab, setTab] = useState<AuthTab>("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "signin") setTab("signin");
    else if (tabParam === "signup" || tabParam === "create") setTab("create");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("oauth_error");
    if (!oauthError) return;

    if (oauthError === "role_conflict") {
      const role = params.get("role") ?? "user";
      toast.error(
        `This Google account is signed up as an ${role} on BahayGo. To list dormspaces, please use a different Google account or create a separate landlord account with email/password.`,
      );
    } else if (oauthError === "server") {
      toast.error("Something went wrong during sign-in. Please try again.");
    }

    window.history.replaceState({}, "", "/dormspaces/welcome");
  }, []);

  useEffect(() => {
    if (!isLandlordSignedIn || !user) {
      setListingCount(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/dormspaces/landlord/listings", { credentials: "include" });
        const json = (await res.json()) as {
          success?: boolean;
          data?: { items?: unknown[] };
        };
        if (!cancelled && res.ok) {
          setListingCount(json.data?.items?.length ?? 0);
        } else if (!cancelled) {
          setListingCount(0);
        }
      } catch {
        if (!cancelled) setListingCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLandlordSignedIn, user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || password.length < 8) {
      setError("Enter a valid email and a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dormspaces/welcome/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not create account");
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInErr) {
        setError("Account created but sign-in failed. Try signing in.");
        setTab("signin");
        return;
      }

      router.replace("/dormspaces/submit?from=welcome");
      router.refresh();
    } catch (err) {
      if (isDuplicateSignupError(err)) {
        setError("An account with this email already exists. Sign in instead.");
        setTab("signin");
        return;
      }
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
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
      if (!isLandlordCapable({ role, is_landlord })) {
        await supabase.auth.signOut();
        setError(
          `This account isn't set up for dormspace listings. Create a landlord account or sign in with an account that has listed before.`,
        );
        if (isDormspaceSubmitBlockedRole(role)) {
          toast.error(
            `This Google account is signed up as an ${roleDisplayLabel(role)} on BahayGo. To list dormspaces, please use a different Google account or create a separate landlord account with email/password.`,
          );
        }
        return;
      }

      router.replace("/dormspaces/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DormspacePortalShell minimalNav>
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-10 xl:gap-16">
        <motion.div
          className="flex flex-col"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        >
          <motion.h1
            custom={0}
            variants={fadeUp}
            className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] md:text-4xl lg:text-[2.35rem]"
          >
            List your dormspace on BahayGo
          </motion.h1>

          <motion.p
            custom={1}
            variants={fadeUp}
            className="mt-4 max-w-lg text-base font-medium leading-relaxed text-[#484848]"
          >
            Free to list. Verified landlords only. Reach students, BPO workers, and young professionals
            across Metro Manila.
          </motion.p>

          <motion.div
            custom={2}
            variants={fadeUp}
            className="mt-8 grid grid-cols-3 gap-2 sm:gap-3"
          >
            {[
              { value: "17+", label: "Metro areas" },
              { value: "₱0", label: "Listing fees" },
              { value: "100%", label: "Filipino-built" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-[#6B9E6E]/20 bg-white/80 px-3 py-3 text-center shadow-sm"
              >
                <p className="font-serif text-lg font-bold text-[#6B9E6E] md:text-xl">{stat.value}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#525252] sm:text-[11px]">
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>

          <motion.div custom={3} variants={fadeUp} className="relative mt-8">
            <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/8 shadow-[0_8px_30px_rgba(44,44,44,0.08)]">
              <div className="relative aspect-[16/10] w-full">
                <Image
                  src={DORMSPACE_HERO_IMAGE}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a2e22]/75 via-[#1a2e22]/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[#2C2C2C] shadow-sm">
                    <BadgeCheck className="size-3 text-[#6B9E6E]" aria-hidden />
                    Verified landlords
                  </span>
                  <span className="rounded-full bg-[#D4A843]/90 px-2.5 py-1 text-[11px] font-bold text-[#2C2C2C] shadow-sm">
                    Free for everyone
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {PREVIEW_LISTINGS.map((listing, i) => (
                <motion.div
                  key={listing.title}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.1, duration: 0.4 }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#DDDDDD] bg-white px-4 py-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#2C2C2C]">{listing.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-[#888888]">
                      <MapPin className="size-3 shrink-0 text-[#6B9E6E]" aria-hidden />
                      {listing.area}
                    </p>
                    <span className="mt-1.5 inline-block rounded-full bg-[#6B9E6E]/10 px-2 py-0.5 text-[10px] font-semibold text-[#4a7a4d]">
                      {listing.tag}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-[#6B9E6E]">{listing.price}</p>
                    <p className="text-[10px] font-semibold text-[#888888]">/ month</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.blockquote
            custom={4}
            variants={fadeUp}
            className="mt-8 border-l-4 border-[#D4A843] bg-white/60 py-1 pl-4 pr-2"
          >
            <p className="font-serif text-base italic leading-relaxed text-[#2C2C2C]">
              &ldquo;I listed my bedspace in one evening. Students messaged me the same week — and BahayGo
              never charged a peso.&rdquo;
            </p>
            <footer className="mt-2 text-xs font-semibold text-[#6B9E6E]">
              — Marla R., landlord · Makati
            </footer>
          </motion.blockquote>

          <motion.p
            custom={5}
            variants={fadeUp}
            className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[#525252]"
          >
            <Sparkles className="size-3.5 text-[#D4A843]" aria-hidden />
            Built for Filipino dorm owners — from QC bedspaces to BGC coliving
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.45 }}
          className="w-full lg:sticky lg:top-24 lg:max-w-md lg:justify-self-end"
        >
          {authLoading ? (
            <div className="rounded-2xl border border-[#DDDDDD] bg-white p-8 shadow-[0_4px_24px_rgba(44,44,44,0.06)]">
              <p className="text-center text-sm font-medium text-[#484848]">Loading…</p>
            </div>
          ) : isLandlordSignedIn ? (
            <LandlordWelcomeCard
              firstName={landlordFirstName(profile?.full_name, user?.email)}
              listingCount={listingCount}
              verificationStatus={normalizeLandlordVerificationStatus(
                profile?.landlord_verification_status,
              )}
              rejectionReason={profile?.landlord_verification_rejection_reason}
            />
          ) : (
            <>
              {isStaffSignedIn && profile ? (
                <p className="mb-4 rounded-xl border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm font-medium text-[#484848]">
                  You&apos;re signed in as a{" "}
                  <span className="font-semibold text-[#2C2C2C]">{roleDisplayLabel(profile.role)}</span>.
                  To list a dormspace, sign out and create a separate landlord account.
                </p>
              ) : null}
              <div className="rounded-2xl border border-[#DDDDDD] bg-white p-6 shadow-[0_4px_24px_rgba(44,44,44,0.06)] sm:p-8">
            <div
              className="flex rounded-xl border border-[#2C2C2C]/8 bg-[#FAF8F4] p-1"
              role="tablist"
              aria-label="Account"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "signin"}
                onClick={() => {
                  setTab("signin");
                  setError("");
                }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${
                  tab === "signin"
                    ? "bg-white text-[#2C2C2C] shadow-sm"
                    : "text-[#888888] hover:text-[#484848]"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "create"}
                onClick={() => {
                  setTab("create");
                  setError("");
                }}
                className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition ${
                  tab === "create"
                    ? "bg-white text-[#2C2C2C] shadow-sm"
                    : "text-[#888888] hover:text-[#484848]"
                }`}
              >
                Create account
              </button>
            </div>

            <div className="mt-6">
              <ContinueWithGoogleButton
                onError={setError}
                callbackPath="/auth/callback?context=landlord"
              />
              <AuthGoogleDivider />
            </div>

            {tab === "create" ? (
              <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
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
                  {busy ? "Creating account…" : "Create account & continue"}
                </button>
                <p className="text-center text-xs font-medium leading-relaxed text-[#888888]">
                  By creating an account, you agree to BahayGo&apos;s verified-landlord process — you&apos;ll
                  upload your ID and proof of billing when listing your first dormspace.
                </p>
              </form>
            ) : (
              <form onSubmit={(e) => void handleSignIn(e)} className="space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
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
                  {busy ? "Signing in…" : "Sign in"}
                </button>
                <p className="text-center text-xs font-medium text-[#888888]">
                  Need to manage existing listings? Sign in here.
                </p>
              </form>
            )}
              </div>
            </>
          )}

          {!isLandlordSignedIn ? (
            <div className="mt-5">
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-[#2C2C2C]/10" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#FAF8F4] px-2 font-medium text-[#888888]">or</span>
                </div>
              </div>
              <p className="mt-4 text-center">
                <Link
                  href="/dormspaces"
                  className="text-sm font-semibold text-[#6B9E6E] transition hover:text-[#5d8a60] hover:underline"
                >
                  Just looking? Browse dormspaces →
                </Link>
              </p>
            </div>
          ) : (
            <p className="mt-5 text-center">
              <Link
                href="/dormspaces"
                className="text-sm font-semibold text-[#6B9E6E] transition hover:text-[#5d8a60] hover:underline"
              >
                Just looking? Browse dormspaces →
              </Link>
            </p>
          )}

          {!isLandlordSignedIn && !authLoading ? (
            <p className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-[#888888]">
              <Wifi className="size-3.5 text-[#6B9E6E]/70" aria-hidden />
              Secure sign-in · Your listing stays private until verified
            </p>
          ) : null}
        </motion.div>
      </main>

      <footer className="border-t border-[#2C2C2C]/8 py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Link href="/" className="text-sm font-semibold text-[#6B9E6E] hover:underline">
            ← Back to BahayGo
          </Link>
        </div>
      </footer>
    </DormspacePortalShell>
  );
}

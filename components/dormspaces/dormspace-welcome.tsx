"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BadgeCheck, MapPin, Plus, Sparkles, Wifi } from "lucide-react";
import { toast } from "sonner";

import { DormspaceAddListingSplitButton } from "@/components/dormspaces/dormspace-add-listing-split-button";
import {
  ClientSignedInCard,
  EmailFirstAuthCard,
  StaffRoleNoticeCard,
} from "@/components/dormspaces/dormspace-welcome-auth";
import { DormspaceLandlordVerificationBanner } from "@/components/dormspaces/dormspace-landlord-verification-banner";
import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import {
  UpdateVacancyModal,
  type VacancyModalListing,
} from "@/components/dormspaces/update-vacancy-modal";
import type { DormspaceWithPhotos } from "@/lib/dormspaces";
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

function WelcomeCardButtonSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="h-12 animate-pulse rounded-xl bg-[#2C2C2C]/10" />
      <div className="h-12 animate-pulse rounded-xl bg-[#2C2C2C]/8" />
    </div>
  );
}

function LandlordWelcomeCard({
  firstName,
  listings,
  listingsResolved,
  verificationStatus,
  rejectionReason,
  onUpdateVacancy,
}: {
  firstName: string;
  listings: DormspaceWithPhotos[];
  listingsResolved: boolean;
  verificationStatus: ReturnType<typeof normalizeLandlordVerificationStatus>;
  rejectionReason?: string | null;
  onUpdateVacancy: (listing: VacancyModalListing) => void;
}) {
  const hasListings = listings.length > 0;
  const showFirstListing = listingsResolved && !hasListings;
  const showReturning = !listingsResolved || hasListings;
  const verified = isVerifiedLandlordProfile(verificationStatus);

  return (
    <div className="rounded-2xl border border-[#DDDDDD] bg-white p-6 shadow-[0_8px_32px_rgba(44,44,44,0.08)] sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6B9E6E]">Landlord account</p>
      <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-[1.65rem]">
        Welcome back, {firstName}
      </h2>
      <p className="mt-2 text-sm font-medium leading-relaxed text-[#484848]">
        {!listingsResolved ? (
          <span className="inline-block h-4 w-48 max-w-full animate-pulse rounded bg-[#2C2C2C]/10" />
        ) : hasListings ? (
          `You have ${listings.length} listing${listings.length === 1 ? "" : "s"} in your dashboard.`
        ) : (
          "You don't have any listings yet. Add your first dormspace to reach students and young professionals."
        )}
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
        {showReturning ? (
          !listingsResolved ? (
            <WelcomeCardButtonSkeleton />
          ) : (
            <>
              <Link
                href="/dormspaces/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
              >
                Go to dashboard
              </Link>
              <DormspaceAddListingSplitButton
                listings={listings}
                onUpdateVacancy={onUpdateVacancy}
                submitHref="/dormspaces/submit?from=welcome"
                primaryLabel="+ Add another dormspace"
                fullWidth
              />
            </>
          )
        ) : showFirstListing ? (
          <Link
            href="/dormspaces/submit?from=welcome"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
          >
            <Plus className="size-4" aria-hidden />
            Add your first dormspace
          </Link>
        ) : null}
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center text-sm font-semibold text-[#6B9E6E] hover:underline"
        >
          Go to homepage
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
  const isClientSignedIn = Boolean(
    user && profile && !isLandlordSignedIn && !isStaffSignedIn && profile.role === "client",
  );

  const [listings, setListings] = useState<DormspaceWithPhotos[]>([]);
  const [listingsResolved, setListingsResolved] = useState(false);
  const [vacancyListing, setVacancyListing] = useState<VacancyModalListing | null>(null);
  const [vacancyModalOpen, setVacancyModalOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  const loadLandlordListings = useCallback(async () => {
    if (!isLandlordSignedIn || !user) {
      setListings([]);
      setListingsResolved(true);
      return;
    }
    setListingsResolved(false);
    try {
      const res = await fetch("/api/dormspaces/landlord/listings", { credentials: "include" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { items?: DormspaceWithPhotos[] };
      };
      if (res.ok) {
        setListings(json.data?.items ?? []);
      } else {
        setListings([]);
      }
    } catch {
      setListings([]);
    } finally {
      setListingsResolved(true);
    }
  }, [isLandlordSignedIn, user]);

  useEffect(() => {
    if (authLoading) return;
    void loadLandlordListings();
  }, [authLoading, loadLandlordListings]);

  const handleStaffSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <DormspacePortalShell minimalNav>
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:items-start lg:gap-12 lg:py-10 xl:gap-16">
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
          className="w-full lg:sticky lg:top-24 lg:flex lg:min-h-[calc(100dvh-7rem)] lg:max-w-md lg:flex-col lg:justify-center lg:justify-self-end lg:self-start"
        >
          {authLoading ? (
            <div className="rounded-2xl border border-[#DDDDDD] bg-white p-8 shadow-[0_4px_24px_rgba(44,44,44,0.06)]">
              <p className="text-center text-sm font-medium text-[#484848]">Loading…</p>
            </div>
          ) : isLandlordSignedIn ? (
            <LandlordWelcomeCard
              firstName={landlordFirstName(profile?.full_name, user?.email)}
              listings={listings}
              listingsResolved={listingsResolved}
              verificationStatus={normalizeLandlordVerificationStatus(
                profile?.landlord_verification_status,
              )}
              rejectionReason={profile?.landlord_verification_rejection_reason}
              onUpdateVacancy={(listing) => {
                setVacancyListing(listing);
                setVacancyModalOpen(true);
              }}
            />
          ) : isStaffSignedIn && profile ? (
            <StaffRoleNoticeCard
              role={profile.role}
              onSignOut={() => void handleStaffSignOut()}
              signingOut={signingOut}
            />
          ) : isClientSignedIn ? (
            <>
              <p className="mb-4 rounded-xl border border-[#6B9E6E]/25 bg-[#6B9E6E]/8 px-4 py-3 text-sm font-medium text-[#484848]">
                You&apos;re signed in as a client. Creating a listing here will let you list your own space
                when you&apos;re ready — your client account stays intact.
              </p>
              <ClientSignedInCard />
            </>
          ) : (
            <EmailFirstAuthCard />
          )}

          {!isLandlordSignedIn && !isStaffSignedIn ? (
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
          ) : !isLandlordSignedIn && isStaffSignedIn ? null : (
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

      <UpdateVacancyModal
        open={vacancyModalOpen}
        onOpenChange={setVacancyModalOpen}
        listing={vacancyListing}
        onSaved={() => void loadLandlordListings()}
      />
    </DormspacePortalShell>
  );
}

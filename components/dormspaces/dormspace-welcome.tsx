"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, ChevronLeft, Home, MapPin, Plus, Shield } from "lucide-react";
import { toast } from "sonner";

import { DormspaceAddListingSplitButton } from "@/components/dormspaces/dormspace-add-listing-split-button";
import { DormspaceWelcomeLogo } from "@/components/dormspaces/dormspace-welcome-logo";
import {
  ClientSignedInCard,
  StaffRoleNoticeCard,
  WelcomeGuestBrowse,
  WelcomeHeroAuthPanel,
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
import { isSafeAuthNext } from "@/lib/auth-login-path";
import { isDormspaceSubmitBlockedRole, isLandlordCapable } from "@/lib/auth-roles";
import { DORMSPACE_WELCOME_HERO_IMAGE } from "@/lib/dormspaces";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const HERO_STATS = [
  { icon: MapPin, value: "17+", label: "Metro Areas" },
  { icon: Shield, value: "₱0", label: "Listing Fees" },
  { icon: Home, value: "100%", label: "Filipino-Built" },
] as const;

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
      <h2 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-[1.75rem]">
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
                href="/dormspaces/dashboard/listings"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#1a2e22] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#243828]"
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
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1a2e22] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#243828]"
          >
            <Plus className="size-4" aria-hidden />
            Add your first dormspace
          </Link>
        ) : null}
        <Link
          href="/dormspaces"
          className="inline-flex h-10 items-center justify-center text-sm font-semibold text-[#6B9E6E] hover:underline"
        >
          Browse dormspaces
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

function parseWelcomeIntent(searchParams: URLSearchParams): "signin" | "signup" | null {
  const intent = searchParams.get("intent");
  if (intent === "signup" || intent === "signin") return intent;
  if (searchParams.get("tab") === "signup") return "signup";
  return null;
}

export function DormspaceWelcome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile, loading: authLoading } = useAuth();

  const welcomeIntent = useMemo(
    () => parseWelcomeIntent(searchParams),
    [searchParams],
  );

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

  useEffect(() => {
    if (authLoading || !isLandlordSignedIn) return;
    const next = searchParams.get("next");
    if (!isSafeAuthNext(next)) return;
    router.replace(next);
  }, [authLoading, isLandlordSignedIn, searchParams, router]);

  const handleStaffSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  const landlordCard = (
    <LandlordWelcomeCard
      firstName={landlordFirstName(profile?.full_name, user?.email)}
      listings={listings}
      listingsResolved={listingsResolved}
      verificationStatus={normalizeLandlordVerificationStatus(profile?.landlord_verification_status)}
      rejectionReason={profile?.landlord_verification_rejection_reason}
      onUpdateVacancy={(listing) => {
        setVacancyListing(listing);
        setVacancyModalOpen(true);
      }}
    />
  );

  const staffCard =
    profile && isStaffSignedIn ? (
      <StaffRoleNoticeCard
        role={profile.role}
        onSignOut={() => void handleStaffSignOut()}
        signingOut={signingOut}
      />
    ) : null;

  const clientCard = isClientSignedIn ? <ClientSignedInCard /> : null;

  const showSignedInPanel =
    authLoading || isLandlordSignedIn || isStaffSignedIn || isClientSignedIn;

  return (
    <DormspacePortalShell mobileFillViewport hidePortalChrome>
      <div className="grid h-full min-h-0 w-full overflow-hidden max-md:grid-rows-[minmax(0,2fr)_minmax(0,3fr)] md:grid-cols-2 md:grid-rows-1">
        <section className="relative flex min-h-0 flex-col overflow-hidden">
          <Image
            src={DORMSPACE_WELCOME_HERO_IMAGE}
            alt="Students relaxing together in a shared dorm space"
            fill
            className="object-cover object-[center_35%]"
            sizes="(max-width: 768px) 100vw, 50vw"
            quality={90}
            priority
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a2e22]/80 via-[#1a2e22]/35 to-black/25"
            aria-hidden
          />

          <div className="relative z-10 flex min-h-0 flex-1 flex-col p-4 pt-[max(1rem,env(safe-area-inset-top))] md:p-8">
            <div className="flex items-center gap-2.5">
              <Link
                href="/dormspaces"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/90 text-[#2C2C2C] shadow-sm transition hover:bg-white"
                aria-label="Back to dormspaces"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Link>
              <DormspaceWelcomeLogo href="/dormspaces" onHero className="drop-shadow-sm" />
            </div>

            <div className="mt-auto min-w-0 pt-4 md:pt-8">
              <h1 className="font-serif text-[26px] font-semibold leading-[1.12] tracking-tight text-white drop-shadow-sm md:text-[40px] lg:text-[44px]">
                Find your space.
                <br />
                Feel at <span className="text-[#b8e0bb]">dorm.</span>
              </h1>
              <p className="mt-2 max-w-md text-[13px] font-medium leading-snug text-white/90 md:mt-3 md:text-[15px]">
                Free to list. Verified landlords only. Reach students, BPO workers, and young professionals
                across Metro Manila.
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2 md:mt-8 md:gap-3">
                {HERO_STATS.map(({ icon: Icon, value, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center rounded-xl border border-white/20 bg-white/10 px-1 py-2.5 text-center backdrop-blur-sm md:px-2 md:py-3.5"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-white/15 md:size-10">
                      <Icon className="size-3.5 text-[#b8e0bb] md:size-4" strokeWidth={2} aria-hidden />
                    </span>
                    <p className="mt-1 font-serif text-sm font-bold text-white md:text-lg">{value}</p>
                    <p className="mt-0.5 text-[8px] font-semibold uppercase leading-tight tracking-wide text-white/80 md:text-[10px]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden bg-[#FAF8F4]">
          <div
            className={`flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-10 md:py-8 ${showSignedInPanel ? "overflow-y-auto overscroll-y-contain" : "overflow-hidden"}`}
          >
            <div className="flex w-full max-w-[400px] min-h-0 flex-col items-center">
              <div
                className={`w-full min-h-0 shrink ${showSignedInPanel ? "" : "rounded-2xl border border-[#DDDDDD] bg-white p-6 shadow-[0_8px_32px_rgba(44,44,44,0.08)] md:p-8"}`}
              >
                <WelcomeHeroAuthPanel
                  loading={authLoading}
                  intent={welcomeIntent}
                  isLandlordSignedIn={isLandlordSignedIn}
                  isStaffSignedIn={isStaffSignedIn}
                  isClientSignedIn={isClientSignedIn}
                  landlordCard={landlordCard}
                  staffCard={staffCard}
                  clientCard={clientCard}
                  compactMobile
                />
              </div>

              {!showSignedInPanel ? <WelcomeGuestBrowse /> : null}
            </div>
          </div>
        </section>
      </div>

      <UpdateVacancyModal
        open={vacancyModalOpen}
        onOpenChange={setVacancyModalOpen}
        listing={vacancyListing}
        onSaved={() => void loadLandlordListings()}
      />
    </DormspacePortalShell>
  );
}

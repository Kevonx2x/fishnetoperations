"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  Bath,
  BedDouble,
  Building2,
  Check,
  Home,
  MapPin,
  Plus,
  Ruler,
  Shield,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

import { DormspaceAddListingSplitButton } from "@/components/dormspaces/dormspace-add-listing-split-button";
import {
  ClientSignedInCard,
  StaffRoleNoticeCard,
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
import { isDormspaceSubmitBlockedRole, isLandlordCapable } from "@/lib/auth-roles";
import { DORMSPACE_HERO_IMAGE, DORMSPACE_WELCOME_MOBILE_HERO_IMAGE } from "@/lib/dormspaces";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Cozy dorm/studio — matches welcome mockup featured card. */
const FEATURED_LISTING_IMAGE =
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80";

const HERO_STATS = [
  { icon: MapPin, value: "17+", label: "Metro Areas" },
  { icon: Shield, value: "₱0", label: "Listing Fees" },
  { icon: Home, value: "100%", label: "Filipino-Built" },
] as const;

const TRUST_ITEMS = [
  "Verified landlords and listings only",
  "Zero listing fees. Always free.",
  "Made for Filipinos, by Filipinos",
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
                href="/dormspaces/dashboard"
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

  useEffect(() => {
    if (!welcomeIntent) return;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) return;
    const t = window.setTimeout(() => {
      document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [welcomeIntent, authLoading]);

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

  const authPanel = (
    <WelcomeHeroAuthPanel
      loading={authLoading}
      intent={welcomeIntent}
      isLandlordSignedIn={isLandlordSignedIn}
      isStaffSignedIn={isStaffSignedIn}
      isClientSignedIn={isClientSignedIn}
      landlordCard={landlordCard}
      staffCard={staffCard}
      clientCard={clientCard}
    />
  );

  return (
    <DormspacePortalShell minimalNav mobileFillViewport compactMobileNav>
      {/* Mobile — single-screen welcome (no scroll on default sign-in view) */}
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
        <div className="shrink-0">
          <h1 className="font-serif text-[26px] font-semibold leading-[1.12] tracking-tight text-[#2C2C2C]">
            Find your space.
            <br />
            Feel at <span className="text-[#6B9E6E]">dorm.</span>
          </h1>
          <p className="mt-2 text-[13px] font-medium leading-snug text-[#484848]">
            Free to list. Verified landlords only. Reach students, BPO workers, and young professionals
            across Metro Manila.
          </p>

          <div className="relative mt-3 overflow-hidden rounded-2xl border border-[#2C2C2C]/8 shadow-[0_8px_28px_rgba(44,44,44,0.1)]">
            <div className="relative h-[118px] w-full">
              <Image
                src={DORMSPACE_WELCOME_MOBILE_HERO_IMAGE}
                alt="Student smiling from a bunk bed in a dorm"
                fill
                className="object-cover object-[center_20%]"
                sizes="100vw"
                priority
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a2e22]/55 via-transparent to-transparent" />
              <div className="absolute bottom-2.5 left-2.5 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-[#2C2C2C] shadow-sm">
                  <BadgeCheck className="size-3 text-[#6B9E6E]" aria-hidden />
                  Verified landlords
                </span>
                <span className="rounded-full bg-[#D4A843]/95 px-2 py-0.5 text-[10px] font-bold text-[#2C2C2C] shadow-sm">
                  Free to list
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pt-3">
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
      </main>

      {/* Desktop — full marketing welcome */}
      <main className="mx-auto hidden w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:block lg:px-6 lg:pb-16 lg:pt-10">
        {/* Hero — photo visible above the fold (mockup: headline + image + stats | auth card) */}
        <section className="grid gap-6 lg:grid-cols-[1fr_minmax(0,380px)] lg:items-start lg:gap-10">
          <div className="min-w-0">
            <h1 className="font-serif text-[30px] font-semibold leading-[1.12] tracking-tight text-[#2C2C2C] md:text-[38px] lg:text-[42px]">
              Find your space.
              <br />
              Feel at <span className="text-[#6B9E6E]">dorm.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[#484848] md:text-[15px]">
              Free to list. Verified landlords only. Reach students, BPO workers, and young professionals
              across Metro Manila.
            </p>

            <div className="relative mt-5 overflow-hidden rounded-2xl border border-[#2C2C2C]/8 shadow-[0_8px_28px_rgba(44,44,44,0.1)]">
              <div className="relative h-[168px] w-full sm:h-[190px] lg:h-[200px]">
                <Image
                  src={DORMSPACE_HERO_IMAGE}
                  alt="Bright dorm and bedspace interior"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 640px"
                  priority
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a2e22]/55 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-[#2C2C2C] shadow-sm">
                    <BadgeCheck className="size-3 text-[#6B9E6E]" aria-hidden />
                    Verified landlords
                  </span>
                  <span className="rounded-full bg-[#D4A843]/95 px-2.5 py-1 text-[10px] font-bold text-[#2C2C2C] shadow-sm">
                    Free to list
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              {HERO_STATS.map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center rounded-xl border border-[#6B9E6E]/15 bg-white px-1.5 py-3 text-center shadow-sm sm:px-2 sm:py-3.5"
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-[#6B9E6E]/12 sm:size-10">
                    <Icon className="size-4 text-[#6B9E6E] sm:size-5" strokeWidth={2} aria-hidden />
                  </span>
                  <p className="mt-1.5 font-serif text-base font-bold text-[#2C2C2C] sm:text-lg">{value}</p>
                  <p className="mt-0.5 text-[9px] font-semibold uppercase leading-tight tracking-wide text-[#525252] sm:text-[10px]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:sticky lg:top-20">
            {authPanel}
          </div>
        </section>

        {/* Trust banner */}
        <section className="mt-8 rounded-2xl border border-[#DDDDDD] bg-white px-5 py-5 shadow-sm md:mt-10 md:flex md:items-center md:justify-between md:gap-8 md:px-8 md:py-6">
          <div className="flex items-start gap-3 md:min-w-0 md:shrink-0">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#6B9E6E]/12">
              <Building2 className="size-6 text-[#6B9E6E]" aria-hidden />
            </span>
            <div>
              <p className="font-serif text-lg font-bold text-[#2C2C2C] md:text-xl">
                Built for renters. Trusted by landlords.
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 md:mt-0 md:flex-1">
            {TRUST_ITEMS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm font-medium text-[#484848]">
                <Check className="size-4 shrink-0 text-[#6B9E6E]" strokeWidth={2.5} aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Featured dormspaces */}
        <section className="mt-8 md:mt-12">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="font-serif text-xl font-bold text-[#2C2C2C] md:text-2xl">Featured dormspaces</h2>
            <Link
              href="/dormspaces"
              className="shrink-0 text-sm font-semibold text-[#6B9E6E] hover:underline"
            >
              Browse all →
            </Link>
          </div>

          <article className="overflow-hidden rounded-2xl border border-[#DDDDDD] bg-white shadow-[0_4px_24px_rgba(44,44,44,0.08)] sm:flex">
            <div className="relative h-[160px] w-full shrink-0 sm:h-auto sm:w-[42%] sm:min-h-[200px] sm:max-w-[320px]">
              <Image
                src={FEATURED_LISTING_IMAGE}
                alt="Cozy studio dormspace near Araneta Center"
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 320px"
              />
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-[#2C2C2C] shadow-sm">
                <BadgeCheck className="size-3.5 text-[#6B9E6E]" aria-hidden />
                Verified
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center p-5 sm:p-6">
              <span className="inline-flex w-fit rounded-full bg-[#6B9E6E]/12 px-3 py-1 text-xs font-bold text-[#4a7a4d]">
                Quezon City
              </span>
              <h3 className="mt-3 font-serif text-lg font-bold leading-snug text-[#2C2C2C] sm:text-xl">
                Cozy Studio Unit near Araneta Center
              </h3>
              <p className="mt-2 text-lg font-bold text-[#2C2C2C]">
                ₱8,500 <span className="text-sm font-semibold text-[#888888]">/ month</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#525252]">
                <span className="inline-flex items-center gap-1.5">
                  <BedDouble className="size-4 text-[#6B9E6E]" aria-hidden />
                  Studio
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Bath className="size-4 text-[#6B9E6E]" aria-hidden />
                  1 Bath
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Ruler className="size-4 text-[#6B9E6E]" aria-hidden />
                  18 sqm
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Wifi className="size-4 text-[#6B9E6E]" aria-hidden />
                  Wi-Fi Included
                </span>
              </div>
              <Link
                href="/dormspaces"
                className="mt-4 inline-flex h-10 w-fit items-center justify-center rounded-xl border-2 border-[#1a2e22]/20 px-5 text-sm font-bold text-[#1a2e22] transition hover:border-[#6B9E6E]/40 hover:bg-[#6B9E6E]/5"
              >
                View details
              </Link>
            </div>
          </article>
        </section>

        {/* List CTA */}
        <section className="mt-8 rounded-2xl border border-[#6B9E6E]/20 bg-[#6B9E6E]/10 px-5 py-5 md:mt-10 md:flex md:items-center md:justify-between md:gap-8 md:px-6 md:py-6">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[#6B9E6E]/20">
              <Home className="size-6 text-[#6B9E6E]" aria-hidden />
            </span>
            <div>
              <p className="font-serif text-lg font-bold text-[#2C2C2C] md:text-xl">
                List your space for free.
              </p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-[#484848]">
                Connect with thousands of renters looking for their next dorm.
              </p>
            </div>
          </div>
          <Link
            href={user ? "/dormspaces/submit?from=welcome" : "/dormspaces/welcome?intent=signup#get-started"}
            className="mt-5 inline-flex h-12 w-full shrink-0 items-center justify-center rounded-xl bg-[#1a2e22] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#243828] md:mt-0 md:w-auto"
          >
            List your dormspace
          </Link>
        </section>
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

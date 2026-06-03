"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { DormspaceLandlordVerificationBanner } from "@/components/dormspaces/dormspace-landlord-verification-banner";
import { LandlordDashboardSidebar } from "@/components/dormspaces/landlord-dashboard-sidebar";
import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import { useAuth } from "@/contexts/auth-context";
import { dormspacesWelcomeAuthHref } from "@/lib/auth-login-path";
import { isLandlordCapable } from "@/lib/auth-roles";
import { normalizeLandlordVerificationStatus } from "@/lib/landlord-verification";

type Props = {
  children: ReactNode;
  loginNext?: string;
  /** Hub shows verification banner; sub-pages rely on hub + per-card status. */
  variant?: "hub" | "subpage";
};

export function useLandlordDashboardAuth(loginNext = "/dormspaces/dashboard/listings") {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  /** Session user present but profile row not hydrated yet — avoid login bounce. */
  const profilePending = Boolean(user && !profile && !authLoading);

  useEffect(() => {
    if (authLoading || profilePending) return;
    if (!user) {
      router.replace(dormspacesWelcomeAuthHref(loginNext));
      return;
    }
    if (profile && !isLandlordCapable(profile)) {
      router.replace(dormspacesWelcomeAuthHref(loginNext));
    }
  }, [authLoading, profilePending, user, profile, router, loginNext]);

  return {
    user,
    profile,
    authLoading,
    profilePending,
    ready: Boolean(user && profile && isLandlordCapable(profile)),
  };
}

export function LandlordDashboardShell({ children, loginNext, variant = "subpage" }: Props) {
  const { profile, authLoading, profilePending, ready } = useLandlordDashboardAuth(loginNext);
  const showVerificationBanner = variant === "hub";
  const [listingCount, setListingCount] = useState(0);
  const [inquiryCount, setInquiryCount] = useState(0);

  const loadSidebarCounts = useCallback(async () => {
    try {
      const [listingsRes, inquiriesRes] = await Promise.all([
        fetch("/api/dormspaces/landlord/listings", { credentials: "include" }),
        fetch("/api/dormspaces/landlord/inquiries?status=new", { credentials: "include" }),
      ]);
      const listingsJson = (await listingsRes.json()) as { data?: { items?: unknown[] } };
      const inquiriesJson = (await inquiriesRes.json()) as { data?: { items?: unknown[] } };
      if (listingsRes.ok) setListingCount(listingsJson.data?.items?.length ?? 0);
      if (inquiriesRes.ok) setInquiryCount(inquiriesJson.data?.items?.length ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void loadSidebarCounts();
  }, [ready, loadSidebarCounts]);

  if (authLoading || profilePending || !ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#FAF8F4]">
        <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Loading" />
      </div>
    );
  }

  return (
    <DormspacePortalShell variant="landlord">
      {showVerificationBanner && profile ? (
        <div className="sticky top-0 z-30 border-b border-black/[0.04] bg-[#FAF8F4]/95 backdrop-blur-sm md:static">
          <DormspaceLandlordVerificationBanner
            status={normalizeLandlordVerificationStatus(profile.landlord_verification_status)}
            rejectionReason={profile.landlord_verification_rejection_reason}
            submittedAt={profile.landlord_verification_submitted_at}
            className="mx-4 mt-3 mb-3"
          />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col md:min-h-[calc(100dvh-4rem)] md:flex-row">
        <LandlordDashboardSidebar
          listingCount={listingCount}
          inquiryCount={inquiryCount}
          className="hidden md:flex"
        />
        <div className="min-w-0 flex-1 bg-[#FAF8F4]">{children}</div>
      </div>
    </DormspacePortalShell>
  );
}

export function landlordFirstName(
  fullName: string | null | undefined,
  email: string | undefined,
): string {
  const trimmed = fullName?.trim();
  if (trimmed) {
    const space = trimmed.indexOf(" ");
    return space === -1 ? trimmed : trimmed.slice(0, space);
  }
  return email?.split("@")[0] ?? "there";
}

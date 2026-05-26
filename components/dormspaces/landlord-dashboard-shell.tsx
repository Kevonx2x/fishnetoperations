"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { DormspaceLandlordVerificationBanner } from "@/components/dormspaces/dormspace-landlord-verification-banner";
import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import { useAuth } from "@/contexts/auth-context";
import { isLandlordCapable } from "@/lib/auth-roles";
import { normalizeLandlordVerificationStatus } from "@/lib/landlord-verification";

type Props = {
  children: ReactNode;
  loginNext?: string;
  /** Hub shows verification banner; sub-pages rely on hub + per-card status. */
  variant?: "hub" | "subpage";
};

export function useLandlordDashboardAuth(loginNext = "/dormspaces/dashboard") {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isLandlordCapable(profile)) {
      router.replace(`/auth/login?next=${encodeURIComponent(loginNext)}`);
    }
  }, [authLoading, user, profile, router, loginNext]);

  return {
    user,
    profile,
    authLoading,
    ready: Boolean(user && isLandlordCapable(profile)),
  };
}

export function LandlordDashboardShell({ children, loginNext, variant = "subpage" }: Props) {
  const { profile, authLoading, ready } = useLandlordDashboardAuth(loginNext);
  const showVerificationBanner = variant === "hub";

  if (authLoading || !ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#FAF8F4]">
        <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Loading" />
      </div>
    );
  }

  return (
    <DormspacePortalShell variant="landlord">
      {showVerificationBanner && profile ? (
        <div className="sticky top-0 z-30 border-b border-black/[0.04] bg-[#FAF8F4]/95 backdrop-blur-sm">
          <DormspaceLandlordVerificationBanner
            status={normalizeLandlordVerificationStatus(profile.landlord_verification_status)}
            rejectionReason={profile.landlord_verification_rejection_reason}
            submittedAt={profile.landlord_verification_submitted_at}
            className="mx-4 mt-3 mb-3"
          />
        </div>
      ) : null}
      {children}
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

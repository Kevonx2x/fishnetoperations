"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { DormspaceAddListingSplitButton } from "@/components/dormspaces/dormspace-add-listing-split-button";
import { DormspaceBedAvailability } from "@/components/dormspaces/dormspace-bed-availability";
import { LandlordDashboardShell } from "@/components/dormspaces/landlord-dashboard-shell";
import { LandlordDashboardSubpageHeader } from "@/components/dormspaces/landlord-dashboard-subpage-header";
import type { ListingItem } from "@/components/dormspaces/landlord-dashboard-types";
import { DormspaceListingEngagementStats } from "@/components/dormspaces/dormspace-listing-engagement-stats";
import {
  UpdateVacancyModal,
  type VacancyModalListing,
} from "@/components/dormspaces/update-vacancy-modal";
import { useAuth } from "@/contexts/auth-context";
import { normalizeLandlordVerificationStatus } from "@/lib/landlord-verification";
import {
  dormspaceLocationLine,
  dormspacePrimaryPhotoUrl,
  dormspaceStatusLabel,
  formatDormspacePrice,
  type DormspaceStatus,
} from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

function statusBadgeClass(status: DormspaceStatus): string {
  switch (status) {
    case "approved":
      return "bg-[#6B9E6E]/15 text-[#4a7a4d]";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "archived":
      return "bg-[#2C2C2C]/10 text-[#2C2C2C]";
    default:
      return "bg-amber-100 text-amber-900";
  }
}

const LISTING_CARD_CLASS =
  "flex flex-col gap-4 rounded-xl border border-black/[0.08] bg-white p-4 shadow-[0_4px_20px_rgba(44,44,44,0.08)] sm:flex-row sm:items-center";

type Props = {
  welcome?: boolean;
};

export function LandlordDashboardListings({ welcome }: Props) {
  const { profile } = useAuth();
  const verificationStatus = normalizeLandlordVerificationStatus(
    profile?.landlord_verification_status,
  );

  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [error, setError] = useState("");
  const [vacancyListing, setVacancyListing] = useState<VacancyModalListing | null>(null);
  const [vacancyModalOpen, setVacancyModalOpen] = useState(false);

  const loadListings = useCallback(async () => {
    setLoadingListings(true);
    setError("");
    try {
      const res = await fetch("/api/dormspaces/landlord/listings", { credentials: "include" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { items?: ListingItem[] };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not load listings");
        setListings([]);
        return;
      }
      setListings(json.data?.items ?? []);
    } catch {
      setError("Network error");
      setListings([]);
    } finally {
      setLoadingListings(false);
    }
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  const runListingAction = async (id: string, action: "archive" | "restore" | "delete") => {
    if (action === "delete" && !window.confirm("Delete this listing permanently?")) return;
    setError("");
    try {
      const res = await fetch(`/api/dormspaces/landlord/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(json.error?.message ?? "Action failed");
        return;
      }
      await loadListings();
    } catch {
      setError("Action failed");
    }
  };

  const hasPendingListings = listings.some((l) => l.status === "pending");
  const showWelcomeNote = welcome;
  const showPendingListingsHint =
    hasPendingListings && verificationStatus === "approved" && !welcome;

  return (
    <LandlordDashboardShell loginNext="/dormspaces/dashboard/listings">
      <LandlordDashboardSubpageHeader title="My Listings" />

      <div className="mx-auto max-w-5xl px-4 pb-32">
        {error ? <p className="mb-4 text-sm font-medium text-red-600">{error}</p> : null}

        {showWelcomeNote ? (
          <p className="mb-4 text-sm text-[#484848]">
            Your listing is in — we&apos;ll email you when verification finishes.
          </p>
        ) : showPendingListingsHint ? (
          <p className="mb-4 text-sm text-[#888888]">
            Listings in review show as pending on the card below.
          </p>
        ) : null}

        {!loadingListings ? (
          <div className="mb-5">
            <DormspaceAddListingSplitButton
              listings={listings}
              onUpdateVacancy={(listing) => {
                setVacancyListing(listing);
                setVacancyModalOpen(true);
              }}
              fullWidth
            />
          </div>
        ) : null}

        {loadingListings ? (
          <p className="flex items-center gap-2 text-sm text-[#484848]">
            <Loader2 className="size-4 animate-spin" /> Loading listings…
          </p>
        ) : listings.length === 0 ? (
          <div className="rounded-xl border border-black/[0.08] bg-white p-8 text-center shadow-[0_4px_20px_rgba(44,44,44,0.08)]">
            <p className="text-sm font-medium text-[#484848]">
              No dormspaces yet. Add your first listing to get started.
            </p>
            <Link
              href="/dormspaces/submit"
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#6B9E6E] px-5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(107,158,110,0.3)] sm:w-auto"
            >
              Add your first dormspace
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {listings.map((row) => {
              const thumb = row.thumbnail_url ?? dormspacePrimaryPhotoUrl(row.dormspace_photos ?? null);
              return (
                <li key={row.id} className={LISTING_CARD_CLASS}>
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-[#F3F0EA]">
                    {thumb ? (
                      <Image src={thumb} alt="" fill className="object-cover" sizes="80px" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#2C2C2C]">{row.title}</p>
                    <p className="text-sm font-medium text-[#484848]">
                      {formatDormspacePrice(row.monthly_price)} · {dormspaceLocationLine(row)}
                    </p>
                    <div className="mt-1">
                      <DormspaceBedAvailability listing={row} variant="inline" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                          statusBadgeClass(row.status),
                        )}
                        title={row.rejection_reason ?? undefined}
                      >
                        {dormspaceStatusLabel(row.status)}
                      </span>
                      <DormspaceListingEngagementStats
                        likeCount={row.like_count ?? 0}
                        saveCount={row.save_count ?? 0}
                      />
                      <span className="text-xs font-medium text-[#888888]">Views: —</span>
                      <span className="text-xs font-medium text-[#888888]">
                        {row.inquiry_count} {row.inquiry_count === 1 ? "inquiry" : "inquiries"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-black/[0.06] pt-3 sm:border-0 sm:pt-0">
                    <Link
                      href={`/dormspaces/${row.id}`}
                      className="rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2 text-xs font-bold text-[#2C2C2C]"
                    >
                      View
                    </Link>
                    {row.status === "archived" ? (
                      <button
                        type="button"
                        onClick={() => void runListingAction(row.id, "restore")}
                        className="rounded-lg border border-[#2C2C2C]/12 px-3 py-2 text-xs font-bold text-[#2C2C2C]"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void runListingAction(row.id, "archive")}
                        className="rounded-lg border border-[#2C2C2C]/12 px-3 py-2 text-xs font-bold text-[#484848]"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void runListingAction(row.id, "delete")}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <UpdateVacancyModal
        open={vacancyModalOpen}
        onOpenChange={setVacancyModalOpen}
        listing={vacancyListing}
        onSaved={() => void loadListings()}
      />
    </LandlordDashboardShell>
  );
}

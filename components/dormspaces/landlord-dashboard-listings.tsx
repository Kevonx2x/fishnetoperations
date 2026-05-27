"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bed, Loader2, MessageSquare, Pencil, Plus } from "lucide-react";

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
      return "bg-[#6B9E6E]/15 text-[#4a7a4d] ring-1 ring-[#6B9E6E]/20";
    case "rejected":
      return "bg-red-100 text-red-800 ring-1 ring-red-200/60";
    case "archived":
      return "bg-[#2C2C2C]/8 text-[#525252] ring-1 ring-[#2C2C2C]/10";
    default:
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200/70";
  }
}

type Props = {
  welcome?: boolean;
};

function ListingsPageHero({
  listingCount,
  verifiedCount,
  inquiryTotal,
}: {
  listingCount: number;
  verifiedCount: number;
  inquiryTotal: number;
}) {
  return (
    <div className="border-b border-[#2C2C2C]/8 bg-gradient-to-br from-white via-[#FAF8F4] to-[#E8F0E9]/50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6B9E6E]">Landlord dashboard</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] md:text-4xl">
              My Listings
            </h1>
            <p className="mt-2 text-sm font-medium leading-relaxed text-[#484848] md:text-base">
              Manage your dormspaces, update details, and track interest from students.
            </p>
          </div>
          <Link
            href="/dormspaces/submit"
            className="hidden h-11 items-center gap-2 rounded-xl bg-[#6B9E6E] px-5 text-sm font-bold text-white shadow-[0_6px_20px_rgba(107,158,110,0.35)] transition hover:bg-[#5d8a60] md:inline-flex"
          >
            <Plus className="size-4" aria-hidden />
            Add new dormspace
          </Link>
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-3 md:max-w-xl md:gap-4">
          <div className="rounded-xl border border-[#2C2C2C]/8 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-sm md:px-4">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-[#888888]">Listings</dt>
            <dd className="mt-1 font-serif text-2xl font-bold text-[#2C2C2C]">{listingCount}</dd>
          </div>
          <div className="rounded-xl border border-[#2C2C2C]/8 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-sm md:px-4">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-[#888888]">Verified</dt>
            <dd className="mt-1 font-serif text-2xl font-bold text-[#2C2C2C]">{verifiedCount}</dd>
          </div>
          <div className="rounded-xl border border-[#2C2C2C]/8 bg-white/80 px-3 py-3 shadow-sm backdrop-blur-sm md:px-4">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-[#888888]">Inquiries</dt>
            <dd className="mt-1 font-serif text-2xl font-bold text-[#2C2C2C]">{inquiryTotal}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function ListingCard({
  row,
  onArchive,
  onRestore,
  onDelete,
}: {
  row: ListingItem;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const thumb = row.thumbnail_url ?? dormspacePrimaryPhotoUrl(row.dormspace_photos ?? null);
  const editHref = `/dormspaces/dashboard/listings/${row.id}/edit`;

  return (
    <li className="overflow-hidden rounded-2xl border border-[#DDDDDD] bg-white shadow-sm transition hover:shadow-md">
      <div className="flex flex-col md:flex-row">
        <div className="relative aspect-[16/10] w-full shrink-0 bg-[#F3F0EA] md:aspect-auto md:h-auto md:w-72 md:min-h-[220px] lg:w-80">
          {thumb ? (
            <Image src={thumb} alt="" fill className="object-cover" sizes="(max-width:768px) 100vw, 320px" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#E8F0E9] to-[#FAF8F4]" />
          )}
          <div className="absolute left-3 top-3">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm",
                statusBadgeClass(row.status),
              )}
              title={row.rejection_reason ?? undefined}
            >
              {dormspaceStatusLabel(row.status)}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-xl font-bold leading-snug text-[#2C2C2C] md:text-2xl">{row.title}</h2>
              <p className="mt-1 text-sm font-semibold text-[#D4A843]">{formatDormspacePrice(row.monthly_price)}</p>
              <p className="mt-0.5 text-sm font-medium text-[#484848]">{dormspaceLocationLine(row)}</p>
            </div>
          </div>

          <div className="mt-3">
            <DormspaceBedAvailability listing={row} variant="inline" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium text-[#888888]">
            <DormspaceListingEngagementStats
              likeCount={row.like_count ?? 0}
              saveCount={row.save_count ?? 0}
            />
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5 text-[#6B9E6E]" aria-hidden />
              {row.inquiry_count} {row.inquiry_count === 1 ? "inquiry" : "inquiries"}
            </span>
          </div>

          <div className="mt-auto flex flex-wrap gap-2 border-t border-[#2C2C2C]/8 pt-4 md:pt-5">
            <Link
              href={editHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6B9E6E] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#5d8a60]"
            >
              <Pencil className="size-3.5" aria-hidden />
              Edit listing
            </Link>
            <Link
              href={`/dormspaces/${row.id}`}
              className="rounded-lg border border-[#2C2C2C]/12 bg-white px-4 py-2.5 text-sm font-bold text-[#2C2C2C] transition hover:bg-[#FAF8F4]"
            >
              View live
            </Link>
            {row.status === "archived" ? (
              <button
                type="button"
                onClick={onRestore}
                className="rounded-lg border border-[#2C2C2C]/12 px-4 py-2.5 text-sm font-bold text-[#484848] transition hover:bg-[#FAF8F4]"
              >
                Restore
              </button>
            ) : (
              <button
                type="button"
                onClick={onArchive}
                className="rounded-lg border border-[#2C2C2C]/12 px-4 py-2.5 text-sm font-bold text-[#484848] transition hover:bg-[#FAF8F4]"
              >
                Archive
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

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

  const stats = useMemo(() => {
    const verifiedCount = listings.filter((l) => l.status === "approved").length;
    const inquiryTotal = listings.reduce((sum, l) => sum + (l.inquiry_count ?? 0), 0);
    return { verifiedCount, inquiryTotal };
  }, [listings]);

  const hasPendingListings = listings.some((l) => l.status === "pending");
  const showWelcomeNote = welcome;
  const showPendingListingsHint =
    hasPendingListings && verificationStatus === "approved" && !welcome;

  return (
    <LandlordDashboardShell loginNext="/dormspaces/dashboard/listings">
      <div className="md:hidden">
        <LandlordDashboardSubpageHeader title="My Listings" />
      </div>

      <ListingsPageHero
        listingCount={listings.length}
        verifiedCount={stats.verifiedCount}
        inquiryTotal={stats.inquiryTotal}
      />

      <div className="mx-auto max-w-6xl px-4 pb-32 pt-6 md:pb-16 md:pt-8">
        {error ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        {showWelcomeNote ? (
          <p className="mb-4 rounded-xl border border-[#6B9E6E]/25 bg-[#6B9E6E]/10 px-4 py-3 text-sm font-medium text-[#2C2C2C]">
            Your listing is in — we&apos;ll email you when verification finishes.
          </p>
        ) : showPendingListingsHint ? (
          <p className="mb-4 text-sm text-[#888888]">
            Listings in review show as pending on the card below.
          </p>
        ) : null}

        {!loadingListings ? (
          <div className="mb-6 md:hidden">
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
          <div className="rounded-2xl border border-[#DDDDDD] bg-white px-6 py-12 text-center shadow-sm md:px-10">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#6B9E6E]/12">
              <Bed className="size-7 text-[#6B9E6E]" aria-hidden />
            </div>
            <h2 className="mt-4 font-serif text-2xl font-bold text-[#2C2C2C]">No dormspaces yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium text-[#484848]">
              Add your first bedspace or shared room to start reaching students near campus.
            </p>
            <Link
              href="/dormspaces/submit"
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-[0_4px_16px_rgba(107,158,110,0.3)]"
            >
              <Plus className="size-4" aria-hidden />
              Add your first dormspace
            </Link>
          </div>
        ) : (
          <ul className="space-y-5 md:space-y-6">
            {listings.map((row) => (
              <ListingCard
                key={row.id}
                row={row}
                onArchive={() => void runListingAction(row.id, "archive")}
                onRestore={() => void runListingAction(row.id, "restore")}
                onDelete={() => void runListingAction(row.id, "delete")}
              />
            ))}
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

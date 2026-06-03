"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bed, Loader2, MoreHorizontal, Pencil, Plus, Search } from "lucide-react";

import { DormspaceAddListingSplitButton } from "@/components/dormspaces/dormspace-add-listing-split-button";
import { LandlordDashboardShell } from "@/components/dormspaces/landlord-dashboard-shell";
import { LandlordDashboardSubpageHeader } from "@/components/dormspaces/landlord-dashboard-subpage-header";
import type { ListingItem } from "@/components/dormspaces/landlord-dashboard-types";
import {
  UpdateVacancyModal,
  type VacancyModalListing,
} from "@/components/dormspaces/update-vacancy-modal";
import { useAuth } from "@/contexts/auth-context";
import { normalizeLandlordVerificationStatus } from "@/lib/landlord-verification";
import {
  dormspaceLocationLine,
  dormspacePrimaryPhotoUrl,
  dormspaceRoomTypeLabel,
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
      return "bg-[#2C2C2C]/8 text-[#525252]";
    default:
      return "bg-amber-100 text-amber-900";
  }
}

type Props = {
  welcome?: boolean;
};

function listingSearchHaystack(row: ListingItem): string {
  return [row.title, row.city, row.neighborhood, row.address, dormspaceLocationLine(row)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function ListingTableRow({
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
  const inquiryLabel =
    (row.inquiry_count ?? 0) === 0
      ? "No inquiries"
      : `${row.inquiry_count} ${row.inquiry_count === 1 ? "inquiry" : "inquiries"}`;

  return (
    <tr className="border-b border-[#2C2C2C]/8 transition hover:bg-[#FAF8F4]/60">
      <td className="px-4 py-4 align-top">
        <div className="flex gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-[#F3F0EA]">
            {thumb ? (
              <Image src={thumb} alt="" fill className="object-cover" sizes="64px" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#E8F0E9] to-[#FAF8F4]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#2C2C2C]">{row.title}</p>
            <p className="mt-0.5 text-xs font-medium text-[#888888]">
              Listed in {dormspaceRoomTypeLabel(row.room_type)}
            </p>
            <p className="mt-1 text-xs text-[#484848]">{dormspaceLocationLine(row)}</p>
            <span
              className={cn(
                "mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                statusBadgeClass(row.status),
              )}
            >
              {dormspaceStatusLabel(row.status)}
            </span>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-4 align-middle text-sm font-medium text-[#888888] sm:table-cell">
        {inquiryLabel}
      </td>
      <td className="px-4 py-4 align-middle text-sm font-bold text-[#2C2C2C]">
        {formatDormspacePrice(row.monthly_price)}
      </td>
      <td className="px-4 py-4 align-middle">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={editHref}
            className="inline-flex items-center gap-1 rounded-lg bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#5d8a60]"
          >
            <Pencil className="size-3" aria-hidden />
            Edit
          </Link>
          <Link
            href={`/dormspaces/${row.id}`}
            className="rounded-lg border border-[#2C2C2C]/12 px-3 py-1.5 text-xs font-bold text-[#484848] hover:bg-[#FAF8F4]"
          >
            View
          </Link>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center justify-center rounded-lg border border-[#2C2C2C]/12 p-1.5 hover:bg-[#FAF8F4]">
              <MoreHorizontal className="size-4 text-[#484848]" aria-hidden />
              <span className="sr-only">More actions</span>
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-[#2C2C2C]/10 bg-white py-1 shadow-lg">
              {row.status === "archived" ? (
                <button
                  type="button"
                  onClick={onRestore}
                  className="block w-full px-3 py-2 text-left text-xs font-semibold text-[#484848] hover:bg-[#FAF8F4]"
                >
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onArchive}
                  className="block w-full px-3 py-2 text-left text-xs font-semibold text-[#484848] hover:bg-[#FAF8F4]"
                >
                  Archive
                </button>
              )}
              <button
                type="button"
                onClick={onDelete}
                className="block w-full px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </details>
        </div>
      </td>
    </tr>
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
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return listings;
    return listings.filter((row) => listingSearchHaystack(row).includes(q));
  }, [listings, searchQuery]);

  const hasPendingListings = listings.some((l) => l.status === "pending");
  const showWelcomeNote = welcome;
  const showPendingListingsHint =
    hasPendingListings && verificationStatus === "approved" && !welcome;

  return (
    <LandlordDashboardShell loginNext="/dormspaces/dashboard/listings">
      <div className="md:hidden">
        <LandlordDashboardSubpageHeader title="My Listings" />
      </div>

      <div className="px-4 py-6 md:px-8 md:py-8">
        <h1 className="font-serif text-2xl font-bold text-[#2C2C2C] md:text-3xl">My Listings</h1>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search listings</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#888888]"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or area…"
              className="w-full rounded-xl border border-[#DDDDDD] bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-[#2C2C2C] shadow-sm placeholder:text-[#888888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25"
            />
          </label>
          <button
            type="button"
            onClick={() => setSearchQuery((s) => s.trim())}
            className="h-11 shrink-0 rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-[0_4px_14px_rgba(107,158,110,0.35)] transition hover:bg-[#5d8a60] sm:w-auto"
          >
            Search
          </button>
          <Link
            href="/dormspaces/submit"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#6B9E6E]/30 bg-[#6B9E6E]/10 px-5 text-sm font-bold text-[#4a7a4d] transition hover:bg-[#6B9E6E]/15 md:hidden"
          >
            <Plus className="size-4" aria-hidden />
            Add listing
          </Link>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        {showWelcomeNote ? (
          <p className="mt-4 rounded-lg border border-[#6B9E6E]/25 bg-[#6B9E6E]/10 px-4 py-3 text-sm font-medium text-[#2C2C2C]">
            Your listing is in — we&apos;ll email you when verification finishes.
          </p>
        ) : showPendingListingsHint ? (
          <p className="mt-4 text-sm text-[#888888]">Listings in review show as pending in the table below.</p>
        ) : null}

        {!loadingListings ? (
          <div className="mt-4 md:hidden">
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

        <div className="mt-6 overflow-hidden rounded-2xl border border-[#DDDDDD] bg-white shadow-[0_4px_20px_rgba(44,44,44,0.06)]">
          {loadingListings ? (
            <p className="flex items-center gap-2 px-4 py-10 text-sm text-[#484848]">
              <Loader2 className="size-4 animate-spin" /> Loading listings…
            </p>
          ) : filteredListings.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#6B9E6E]/12">
                <Bed className="size-7 text-[#6B9E6E]" aria-hidden />
              </div>
              <h2 className="mt-4 font-serif text-xl font-bold text-[#2C2C2C]">
                {searchQuery.trim() ? "No matching listings" : "No dormspaces yet"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm font-medium text-[#484848]">
                {searchQuery.trim()
                  ? "Try a different search term."
                  : "Add your first bedspace or shared room to start reaching students near campus."}
              </p>
              {!searchQuery.trim() ? (
                <Link
                  href="/dormspaces/submit"
                  className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#6B9E6E] px-6 text-sm font-bold text-white"
                >
                  <Plus className="size-4" aria-hidden />
                  Add your first dormspace
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#DDDDDD] bg-[#FAF8F4]">
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#888888]">
                      Property
                    </th>
                    <th className="hidden px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#888888] sm:table-cell">
                      Inquiries
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#888888]">
                      Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-[#888888]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredListings.map((row) => (
                    <ListingTableRow
                      key={row.id}
                      row={row}
                      onArchive={() => void runListingAction(row.id, "archive")}
                      onRestore={() => void runListingAction(row.id, "restore")}
                      onDelete={() => void runListingAction(row.id, "delete")}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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

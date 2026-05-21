"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Plus } from "lucide-react";

import { DormspacePortalShell } from "@/components/dormspaces/dormspace-portal-shell";
import { useAuth } from "@/contexts/auth-context";
import { isLandlordCapable } from "@/lib/auth-roles";
import {
  dormspaceInquiryStatusLabel,
  dormspaceLocationLine,
  dormspacePrimaryPhotoUrl,
  dormspaceStatusLabel,
  formatDormspacePrice,
  type DormspaceInquiryRow,
  type DormspaceInquiryStatus,
  type DormspacePhotoRow,
  type DormspaceRow,
  type DormspaceStatus,
} from "@/lib/dormspaces";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type TabId = "listings" | "inquiries" | "account";

type ListingItem = DormspaceRow & {
  dormspace_photos?: DormspacePhotoRow[] | null;
  thumbnail_url?: string | null;
  inquiry_count: number;
};

type InquiryItem = DormspaceInquiryRow & {
  dormspaces?: {
    id: string;
    title: string;
    dormspace_photos?: { url: string; display_order: number }[] | null;
  } | null;
};

function statusBadgeClass(status: DormspaceStatus): string {
  switch (status) {
    case "approved":
      return "bg-[#6B9E6E]/15 text-[#4a7a4d]";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "archived":
      return "bg-[#2C2C2C]/10 text-[#2C2C2C]";
    default:
      return "bg-[#2C2C2C]/8 text-[#525252]";
  }
}

function inquiryBadgeClass(status: DormspaceInquiryStatus): string {
  switch (status) {
    case "new":
      return "bg-[#6B9E6E]/15 text-[#4a7a4d]";
    case "responded":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-[#2C2C2C]/8 text-[#525252]";
  }
}

export function LandlordDashboard({ welcome }: { welcome?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();

  const initialTab = (searchParams.get("tab") as TabId | null) ?? "listings";
  const [tab, setTab] = useState<TabId>(
    initialTab === "inquiries" || initialTab === "account" ? initialTab : "listings",
  );

  const [listings, setListings] = useState<ListingItem[]>([]);
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [inquiryFilter, setInquiryFilter] = useState<"all" | DormspaceInquiryStatus>("all");
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [error, setError] = useState("");

  const [accountName, setAccountName] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);

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

  const loadInquiries = useCallback(async () => {
    setLoadingInquiries(true);
    setError("");
    try {
      const q = inquiryFilter === "all" ? "" : `?status=${inquiryFilter}`;
      const res = await fetch(`/api/dormspaces/landlord/inquiries${q}`, { credentials: "include" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { items?: InquiryItem[] };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not load inquiries");
        setInquiries([]);
        return;
      }
      setInquiries(json.data?.items ?? []);
    } catch {
      setError("Network error");
      setInquiries([]);
    } finally {
      setLoadingInquiries(false);
    }
  }, [inquiryFilter]);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/dormspaces/landlord/profile", { credentials: "include" });
      const json = (await res.json()) as {
        data?: { profile?: { full_name?: string | null; email?: string | null; phone?: string | null } };
      };
      if (res.ok && json.data?.profile) {
        setAccountName(json.data.profile.full_name?.trim() ?? "");
        setAccountEmail(json.data.profile.email?.trim() ?? "");
        setAccountPhone(json.data.profile.phone?.trim() ?? "");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "inquiries" || t === "account") setTab(t);
    else setTab("listings");
  }, [searchParams]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isLandlordCapable(profile)) {
      router.replace("/auth/login?next=/dormspaces/dashboard");
      return;
    }
    void loadListings();
    void loadProfile();
  }, [authLoading, user, profile?.role, router, loadListings, loadProfile]);

  useEffect(() => {
    if (tab === "inquiries" && user && isLandlordCapable(profile)) {
      void loadInquiries();
    }
  }, [tab, user, profile?.role, loadInquiries]);

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

  const runInquiryAction = async (id: string, action: "responded" | "archive") => {
    setError("");
    try {
      const res = await fetch(`/api/dormspaces/landlord/inquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not update inquiry");
        return;
      }
      await loadInquiries();
    } catch {
      setError("Could not update inquiry");
    }
  };

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountBusy(true);
    setAccountSaved(false);
    setError("");
    try {
      const res = await fetch("/api/dormspaces/landlord/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ full_name: accountName, phone: accountPhone || null }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not save account");
        return;
      }
      setAccountSaved(true);
      await refreshProfile();
    } catch {
      setError("Could not save account");
    } finally {
      setAccountBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/dormspaces");
    router.refresh();
  };

  if (authLoading || !user || !isLandlordCapable(profile)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Loading" />
      </div>
    );
  }

  const hasPendingListings = listings.some((l) => l.status === "pending");

  return (
    <DormspacePortalShell variant="landlord" activeLandlordTab={tab}>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <nav className="mb-6 flex gap-2 border-b border-[#2C2C2C]/10">
          {(
            [
              ["listings", "My Listings"],
              ["inquiries", "Inquiries"],
              ["account", "Account"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "border-b-2 px-4 py-2 text-sm font-bold transition",
                tab === id
                  ? "border-[#6B9E6E] text-[#2C2C2C]"
                  : "border-transparent text-[#484848] hover:text-[#2C2C2C]",
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        {error ? <p className="mb-4 text-sm font-medium text-red-600">{error}</p> : null}

        {tab === "listings" ? (
          <div>
            {welcome || hasPendingListings ? (
              <p className="mb-4 rounded-lg border border-[#6B9E6E]/25 bg-[#6B9E6E]/10 px-3 py-2 text-sm font-medium text-[#484848]">
                {welcome
                  ? "Welcome! Your listing is submitted — we'll verify your ID and billing proof shortly."
                  : "Listings marked pending are under review — we'll notify you when they go live."}
              </p>
            ) : null}
            <div className="mb-4 flex items-center justify-between gap-3">
              <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">My Listings</h1>
              <Link
                href="/dormspaces/submit"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#6B9E6E] px-4 text-sm font-bold text-white hover:bg-[#5d8a60]"
              >
                <Plus className="size-4" aria-hidden />
                Add new dormspace
              </Link>
            </div>

            {loadingListings ? (
              <p className="flex items-center gap-2 text-sm text-[#484848]">
                <Loader2 className="size-4 animate-spin" /> Loading listings…
              </p>
            ) : listings.length === 0 ? (
              <div className="rounded-2xl border border-[#DDDDDD] bg-white p-8 text-center shadow-sm">
                <p className="text-sm font-medium text-[#484848]">
                  No dormspaces yet. Add your first listing to get started.
                </p>
                <Link
                  href="/dormspaces/submit"
                  className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#6B9E6E] px-5 text-sm font-bold text-white"
                >
                  Add your first dormspace
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {listings.map((row) => {
                  const thumb = row.thumbnail_url ?? dormspacePrimaryPhotoUrl(row.dormspace_photos ?? null);
                  return (
                    <li
                      key={row.id}
                      className="flex flex-col gap-4 rounded-2xl border border-[#DDDDDD] bg-white p-4 shadow-sm sm:flex-row sm:items-center"
                    >
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
                          <span className="text-xs font-medium text-[#484848]">Views: —</span>
                          <span className="text-xs font-medium text-[#484848]">
                            {row.inquiry_count} {row.inquiry_count === 1 ? "inquiry" : "inquiries"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/dormspaces/${row.id}`}
                          className="rounded-lg border border-[#2C2C2C]/12 px-3 py-1.5 text-xs font-bold text-[#2C2C2C]"
                        >
                          View
                        </Link>
                        {row.status === "archived" ? (
                          <button
                            type="button"
                            onClick={() => void runListingAction(row.id, "restore")}
                            className="rounded-lg border border-[#2C2C2C]/12 px-3 py-1.5 text-xs font-bold text-[#2C2C2C]"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void runListingAction(row.id, "archive")}
                            className="rounded-lg border border-[#2C2C2C]/12 px-3 py-1.5 text-xs font-bold text-[#484848]"
                          >
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void runListingAction(row.id, "delete")}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700"
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
        ) : null}

        {tab === "inquiries" ? (
          <div>
            <h1 className="mb-4 font-serif text-2xl font-bold text-[#2C2C2C]">Inquiries</h1>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["all", "new", "responded", "archived"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setInquiryFilter(f)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold capitalize",
                    inquiryFilter === f
                      ? "bg-[#6B9E6E] text-white"
                      : "bg-white text-[#484848] ring-1 ring-[#2C2C2C]/10",
                  )}
                >
                  {f === "all" ? "All" : dormspaceInquiryStatusLabel(f)}
                </button>
              ))}
            </div>

            {loadingInquiries ? (
              <p className="flex items-center gap-2 text-sm text-[#484848]">
                <Loader2 className="size-4 animate-spin" /> Loading inquiries…
              </p>
            ) : inquiries.length === 0 ? (
              <p className="rounded-2xl border border-[#DDDDDD] bg-white p-8 text-center text-sm font-medium text-[#484848]">
                No inquiries yet. Once tenants contact you about a listing, messages appear here.
              </p>
            ) : (
              <ul className="space-y-2">
                {inquiries.map((inq) => {
                  const listing = inq.dormspaces;
                  const thumb = listing
                    ? dormspacePrimaryPhotoUrl(
                        (listing.dormspace_photos ?? []).map((p, i) => ({
                          id: `${i}`,
                          dormspace_id: listing.id,
                          url: p.url,
                          display_order: p.display_order,
                          created_at: "",
                        })),
                      )
                    : null;
                  const expanded = expandedInquiryId === inq.id;
                  const preview =
                    inq.message.length > 80 ? `${inq.message.slice(0, 80)}…` : inq.message;

                  return (
                    <li key={inq.id} className="rounded-2xl border border-[#DDDDDD] bg-white shadow-sm">
                      <button
                        type="button"
                        className="w-full px-4 py-3 text-left"
                        onClick={() => setExpandedInquiryId(expanded ? null : inq.id)}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[#2C2C2C]">{inq.name}</p>
                            <p className="text-xs font-medium text-[#484848]">{inq.email}</p>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                              inquiryBadgeClass(inq.status),
                            )}
                          >
                            {dormspaceInquiryStatusLabel(inq.status)}
                          </span>
                        </div>
                        <div className="mt-2 flex gap-3">
                          {thumb ? (
                            <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-[#F3F0EA]">
                              <Image src={thumb} alt="" fill className="object-cover" sizes="48px" />
                            </div>
                          ) : null}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#2C2C2C]">{listing?.title ?? "Listing"}</p>
                            <p className="mt-1 text-sm text-[#484848]">{expanded ? inq.message : preview}</p>
                            <p className="mt-1 text-[11px] font-medium text-[#888888]">
                              {new Date(inq.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </button>

                      {expanded ? (
                        <div className="border-t border-[#2C2C2C]/8 px-4 py-4">
                          <p className="whitespace-pre-wrap text-sm text-[#484848]">{inq.message}</p>
                          <p className="mt-3 text-sm font-medium text-[#2C2C2C]">
                            {inq.email}
                            {inq.phone ? ` · ${inq.phone}` : ""}
                          </p>
                          {inq.responded_at ? (
                            <p className="mt-2 text-[11px] font-semibold text-[#6B9E6E]">
                              Marked responded {new Date(inq.responded_at).toLocaleString()}
                            </p>
                          ) : null}
                          <div className="mt-4 flex flex-wrap gap-2">
                            {inq.status === "new" ? (
                              <button
                                type="button"
                                onClick={() => void runInquiryAction(inq.id, "responded")}
                                className="rounded-xl bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white"
                              >
                                Mark as responded
                              </button>
                            ) : null}
                            {inq.status !== "archived" ? (
                              <button
                                type="button"
                                onClick={() => void runInquiryAction(inq.id, "archive")}
                                className="rounded-xl border border-[#2C2C2C]/15 px-4 py-2 text-xs font-bold text-[#484848]"
                              >
                                Archive
                              </button>
                            ) : null}
                            <a
                              href={`mailto:${encodeURIComponent(inq.email)}?subject=${encodeURIComponent(
                                `Re: ${listing?.title ?? "Dormspace inquiry"}`,
                              )}`}
                              className="inline-flex items-center gap-1 rounded-xl border border-[#2C2C2C]/15 px-4 py-2 text-xs font-bold text-[#2C2C2C]"
                            >
                              <Mail className="size-3.5" aria-hidden />
                              Reply via email
                            </a>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "account" ? (
          <div className="max-w-md">
            <h1 className="mb-4 font-serif text-2xl font-bold text-[#2C2C2C]">Account</h1>
            <form onSubmit={(e) => void saveAccount(e)} className="space-y-4 rounded-2xl border border-[#DDDDDD] bg-white p-5 shadow-sm">
              <label className="block text-xs font-semibold uppercase text-[#525252]">
                Name
                <input
                  className="mt-1 w-full rounded-xl border border-[#2C2C2C]/12 px-3 py-2.5 text-sm font-medium"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  required
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-[#525252]">
                Email
                <input
                  className="mt-1 w-full rounded-xl border border-[#2C2C2C]/12 bg-[#F3F0EA] px-3 py-2.5 text-sm font-medium text-[#484848]"
                  value={accountEmail}
                  readOnly
                />
                <span className="mt-1 block text-[11px] font-medium text-[#888888]">Contact admin to change email.</span>
              </label>
              <label className="block text-xs font-semibold uppercase text-[#525252]">
                Phone
                <input
                  className="mt-1 w-full rounded-xl border border-[#2C2C2C]/12 px-3 py-2.5 text-sm font-medium"
                  value={accountPhone}
                  onChange={(e) => setAccountPhone(e.target.value)}
                />
              </label>
              {accountSaved ? (
                <p className="text-sm font-medium text-[#6B9E6E]">Account updated.</p>
              ) : null}
              <button
                type="submit"
                disabled={accountBusy}
                className="h-10 w-full rounded-xl bg-[#6B9E6E] text-sm font-bold text-white disabled:opacity-60"
              >
                {accountBusy ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="h-10 w-full rounded-xl border border-[#2C2C2C]/15 text-sm font-bold text-[#484848]"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </DormspacePortalShell>
  );
}

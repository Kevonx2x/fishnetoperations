"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

import {
  dormspaceInquiryStatusLabel,
  dormspaceRoomTypeLabel,
  formatDormspacePrice,
  type DormspaceInquiryRow,
  type DormspaceInquiryStatus,
  type DormspacePhotoRow,
  type DormspaceRow,
} from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

type PendingRow = Pick<
  DormspaceRow,
  "id" | "created_at" | "title" | "landlord_name" | "landlord_email" | "status" | "monthly_price" | "city" | "room_type"
>;

type DetailRow = DormspaceRow & {
  dormspace_photos?: DormspacePhotoRow[] | null;
  landlord_id_signed_url?: string | null;
  proof_of_billing_signed_url?: string | null;
};

const FIELD =
  "mt-1 w-full rounded-lg border border-[#2C2C2C]/12 bg-white px-3 py-2 text-sm text-[#2C2C2C]";

type AdminInquiryRow = DormspaceInquiryRow & {
  dormspaces?: {
    title?: string;
    landlord_name?: string;
    landlord_email?: string;
    status?: string;
  } | null;
};

function DormspaceAdminInquiriesPanel() {
  const [items, setItems] = useState<AdminInquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/dormspace-inquiries", { credentials: "include" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { items?: AdminInquiryRow[] };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not load inquiries");
        setItems([]);
        return;
      }
      setItems(json.data?.items ?? []);
    } catch {
      setError("Network error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-[#484848]">
        Read-only view of tenant inquiries across all landlords (for dispute investigation).
      </p>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-[#484848]">
          <Loader2 className="size-4 animate-spin" /> Loading inquiries…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm font-medium text-[#484848]">No inquiries yet.</p>
      ) : (
        <ul className="divide-y divide-[#2C2C2C]/8 rounded-2xl border border-[#2C2C2C]/10 bg-white">
          {items.map((row) => {
            const expanded = expandedId === row.id;
            const listing = row.dormspaces;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left hover:bg-[#FAF8F4]"
                  onClick={() => setExpandedId(expanded ? null : row.id)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#2C2C2C]">{row.name}</p>
                      <p className="text-xs text-[#484848]">{row.email}</p>
                    </div>
                    <span className="rounded-full bg-[#2C2C2C]/8 px-2 py-0.5 text-[10px] font-bold uppercase">
                      {dormspaceInquiryStatusLabel(row.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-[#525252]">
                    {listing?.title ?? "Listing"} · {listing?.landlord_name ?? "—"} ·{" "}
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                  {!expanded ? (
                    <p className="mt-1 line-clamp-2 text-sm text-[#484848]">{row.message}</p>
                  ) : null}
                </button>
                {expanded ? (
                  <div className="border-t border-[#2C2C2C]/8 px-4 pb-4">
                    <p className="whitespace-pre-wrap pt-3 text-sm text-[#484848]">{row.message}</p>
                    <p className="mt-2 text-xs text-[#525252]">
                      Landlord: {listing?.landlord_email ?? "—"} · Listing status: {listing?.status ?? "—"}
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type LandlordVerificationRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  landlord_verification_submitted_at: string | null;
  created_at: string | null;
};

type LandlordVerificationDetail = LandlordVerificationRow & {
  landlord_id_signed_url?: string | null;
  landlord_proof_of_billing_signed_url?: string | null;
  landlord_verification_rejection_reason?: string | null;
  dormspace_count?: number;
};

function DormspaceAdminLandlordVerificationPanel() {
  const [items, setItems] = useState<LandlordVerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LandlordVerificationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/landlord-verifications", { credentials: "include" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { items?: LandlordVerificationRow[] };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not load verifications");
        setItems([]);
        return;
      }
      setItems(json.data?.items ?? []);
    } catch {
      setError("Network error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setSelectedId(id);
    setRejectReason("");
    try {
      const res = await fetch(`/api/admin/landlord-verifications/${id}`, { credentials: "include" });
      const json = (await res.json()) as LandlordVerificationDetail & {
        error?: { message?: string };
      };
      if (!res.ok) {
        setDetail(null);
        setError(json.error?.message ?? "Could not load details");
        return;
      }
      setDetail(json);
    } catch {
      setDetail(null);
      setError("Could not load details");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const runAction = async (action: "approve" | "reject") => {
    if (!selectedId) return;
    setActionBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/landlord-verifications/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action,
          rejection_reason: action === "reject" ? rejectReason : undefined,
        }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(json.error?.message ?? "Action failed");
        return;
      }
      setDetail(null);
      setSelectedId(null);
      await loadList();
    } catch {
      setError("Action failed");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-[#484848]">
        Review each landlord once. Approved landlords show the verified badge on all listings; listing
        content is reviewed separately.
      </p>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#525252]">
            Pending landlords ({items.length})
          </h3>
          {loading ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-[#484848]">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="mt-6 text-sm font-medium text-[#484848]">No pending landlord verifications.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[#2C2C2C]/8">
              {items.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void loadDetail(row.id)}
                    className={`w-full px-1 py-3 text-left transition hover:bg-[#FAF8F4] ${
                      selectedId === row.id ? "bg-[#6B9E6E]/8" : ""
                    }`}
                  >
                    <p className="font-semibold text-[#2C2C2C]">{row.full_name ?? "Landlord"}</p>
                    <p className="text-xs font-medium text-[#484848]">{row.email ?? "—"}</p>
                    <p className="mt-0.5 text-[11px] text-[#888888]">
                      Submitted{" "}
                      {row.landlord_verification_submitted_at
                        ? new Date(row.landlord_verification_submitted_at).toLocaleString()
                        : "—"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm md:p-6">
          {!selectedId ? (
            <p className="text-sm font-medium text-[#484848]">Select a landlord to review documents.</p>
          ) : detailLoading ? (
            <p className="flex items-center gap-2 text-sm text-[#484848]">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          ) : detail ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">{detail.full_name ?? "Landlord"}</h3>
                <p className="text-sm text-[#484848]">
                  {detail.email ?? "—"} · {detail.phone ?? "—"}
                </p>
                <p className="mt-1 text-xs text-[#888888]">
                  {detail.dormspace_count ?? 0} dormspace listing
                  {(detail.dormspace_count ?? 0) === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {detail.landlord_id_signed_url ? (
                  <a
                    href={detail.landlord_id_signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-[#6B9E6E] hover:underline"
                  >
                    View valid ID
                  </a>
                ) : null}
                {detail.landlord_proof_of_billing_signed_url ? (
                  <a
                    href={detail.landlord_proof_of_billing_signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-[#6B9E6E] hover:underline"
                  >
                    View proof of billing
                  </a>
                ) : null}
              </div>
              <label className="block text-xs font-semibold uppercase text-[#525252]">
                Rejection reason (if rejecting)
                <textarea
                  className={FIELD}
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Shown to landlord — required for reject"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void runAction("approve")}
                  className="rounded-xl bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#5d8a60] disabled:opacity-60"
                >
                  Approve landlord
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void runAction("reject")}
                  className="rounded-xl border border-red-300 bg-white px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DormspaceAdminSubmissionsPanel() {
  const [items, setItems] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/dormspaces?status=pending", { credentials: "include" });
      const json = (await res.json()) as { items?: PendingRow[]; error?: string | { message?: string } };
      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : json.error?.message;
        setError(msg ?? "Could not load submissions");
        setItems([]);
        return;
      }
      setItems(json.items ?? []);
    } catch {
      setError("Network error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setSelectedId(id);
    setRejectReason("");
    try {
      const res = await fetch(`/api/admin/dormspaces/${id}`, { credentials: "include" });
      const json = (await res.json()) as DetailRow & { error?: string | { message?: string } };
      if (!res.ok) {
        setDetail(null);
        const msg = typeof json.error === "string" ? json.error : json.error?.message;
        setError(msg ?? "Could not load details");
        return;
      }
      setDetail(json);
    } catch {
      setDetail(null);
      setError("Could not load details");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const runAction = async (action: "approve" | "reject") => {
    if (!selectedId) return;
    setActionBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/dormspaces/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action,
          rejection_reason: action === "reject" ? rejectReason : undefined,
        }),
      });
      const json = (await res.json()) as { error?: string | { message?: string } };
      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : json.error?.message;
        setError(msg ?? "Action failed");
        return;
      }
      setDetail(null);
      setSelectedId(null);
      await loadList();
    } catch {
      setError("Action failed");
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-[#484848]">
        Review pending dormspace listings (photos, details, pricing). Landlord identity is verified separately.
      </p>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#525252]">Pending ({items.length})</h3>
          {loading ? (
            <p className="mt-6 flex items-center gap-2 text-sm text-[#484848]">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="mt-6 text-sm font-medium text-[#484848]">No pending submissions.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[#2C2C2C]/8">
              {items.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void loadDetail(row.id)}
                    className={`w-full px-1 py-3 text-left transition hover:bg-[#FAF8F4] ${
                      selectedId === row.id ? "bg-[#6B9E6E]/8" : ""
                    }`}
                  >
                    <p className="font-semibold text-[#2C2C2C]">{row.title}</p>
                    <p className="text-xs font-medium text-[#484848]">
                      {row.landlord_name} · {new Date(row.created_at).toLocaleDateString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm md:p-6">
          {!selectedId ? (
            <p className="text-sm font-medium text-[#484848]">Select a submission to review.</p>
          ) : detailLoading ? (
            <p className="flex items-center gap-2 text-sm text-[#484848]">
              <Loader2 className="size-4 animate-spin" /> Loading details…
            </p>
          ) : detail ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#2C2C2C]">{detail.title}</h3>
                <p className="text-sm font-medium text-[#484848]">
                  {formatDormspacePrice(detail.monthly_price)} · {dormspaceRoomTypeLabel(detail.room_type)} ·{" "}
                  {detail.city ?? "—"}
                </p>
              </div>
              <p className="text-sm text-[#484848]">
                <strong>Landlord:</strong> {detail.landlord_name} ({detail.landlord_email}, {detail.landlord_phone})
              </p>
              <p className="text-sm text-[#484848]">
                <strong>Address:</strong> {detail.address}
              </p>
              {detail.description ? (
                <p className="whitespace-pre-wrap text-sm text-[#484848]">{detail.description}</p>
              ) : null}
              <p className="text-xs font-medium text-[#888888]">
                Landlord verification is reviewed in the <strong>Landlord Verification</strong> queue (one
                review per landlord, not per listing).
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(detail.dormspace_photos ?? []).map((ph) => (
                  <div key={ph.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#F3F0EA]">
                    <Image src={ph.url} alt="" fill className="object-cover" sizes="160px" />
                  </div>
                ))}
              </div>
              <label className="block text-xs font-semibold uppercase text-[#525252]">
                Rejection reason (if rejecting)
                <textarea
                  className={FIELD}
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Optional — shown to landlord"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void runAction("approve")}
                  className="rounded-xl bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#5d8a60] disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void runAction("reject")}
                  className="rounded-xl border border-red-300 bg-white px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DormspaceAdminSection() {
  const [subTab, setSubTab] = useState<"verification" | "listings" | "inquiries">("verification");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Dormspaces</h2>
        <nav className="mt-3 flex flex-wrap gap-2 border-b border-[#2C2C2C]/10">
          <button
            type="button"
            onClick={() => setSubTab("verification")}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-bold",
              subTab === "verification"
                ? "border-[#6B9E6E] text-[#2C2C2C]"
                : "border-transparent text-[#484848]",
            )}
          >
            Landlord Verification
          </button>
          <button
            type="button"
            onClick={() => setSubTab("listings")}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-bold",
              subTab === "listings"
                ? "border-[#6B9E6E] text-[#2C2C2C]"
                : "border-transparent text-[#484848]",
            )}
          >
            Listings Queue
          </button>
          <button
            type="button"
            onClick={() => setSubTab("inquiries")}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-bold",
              subTab === "inquiries"
                ? "border-[#6B9E6E] text-[#2C2C2C]"
                : "border-transparent text-[#484848]",
            )}
          >
            Dormspace Inquiries
          </button>
        </nav>
      </div>
      {subTab === "verification" ? (
        <DormspaceAdminLandlordVerificationPanel />
      ) : subTab === "listings" ? (
        <DormspaceAdminSubmissionsPanel />
      ) : (
        <DormspaceAdminInquiriesPanel />
      )}
    </div>
  );
}

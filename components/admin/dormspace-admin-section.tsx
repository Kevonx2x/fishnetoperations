"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

import {
  dormspaceRoomTypeLabel,
  formatDormspacePrice,
  type DormspacePhotoRow,
  type DormspaceRow,
} from "@/lib/dormspaces";

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

export function DormspaceAdminSection() {
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
      <div>
        <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">Dormspace Submissions</h2>
        <p className="mt-1 text-sm font-medium text-[#484848]">Review pending landlord listings before they go live.</p>
      </div>

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
                {detail.proof_of_billing_signed_url ? (
                  <a
                    href={detail.proof_of_billing_signed_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-[#6B9E6E] hover:underline"
                  >
                    View proof of billing
                  </a>
                ) : null}
              </div>
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

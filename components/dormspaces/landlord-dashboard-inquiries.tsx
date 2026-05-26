"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Mail } from "lucide-react";

import { LandlordDashboardShell } from "@/components/dormspaces/landlord-dashboard-shell";
import { LandlordDashboardSubpageHeader } from "@/components/dormspaces/landlord-dashboard-subpage-header";
import type { InquiryItem } from "@/components/dormspaces/landlord-dashboard-types";
import {
  dormspaceInquiryStatusLabel,
  dormspacePrimaryPhotoUrl,
  type DormspaceInquiryStatus,
} from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

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

export function LandlordDashboardInquiries() {
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [inquiryFilter, setInquiryFilter] = useState<"all" | DormspaceInquiryStatus>("all");
  const [expandedInquiryId, setExpandedInquiryId] = useState<string | null>(null);
  const [loadingInquiries, setLoadingInquiries] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    void loadInquiries();
  }, [loadInquiries]);

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

  return (
    <LandlordDashboardShell loginNext="/dormspaces/dashboard/inquiries">
      <LandlordDashboardSubpageHeader title="Inquiries" />
      <div className="mx-auto max-w-5xl px-4 pb-32">
        {error ? <p className="mb-4 text-sm font-medium text-red-600">{error}</p> : null}

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
                <li
                  key={inq.id}
                  className="rounded-xl border border-black/[0.08] bg-white shadow-[0_4px_20px_rgba(44,44,44,0.08)]"
                >
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
    </LandlordDashboardShell>
  );
}

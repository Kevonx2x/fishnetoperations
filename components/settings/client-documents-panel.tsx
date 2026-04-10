"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  CLIENT_DOCUMENT_TYPES,
  type ClientDocumentTypeKey,
  isClientDocumentType,
  labelForClientDocType,
} from "@/lib/client-documents";
import { cn } from "@/lib/utils";

export type ClientDocRow = {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
  shared_with: string[] | null;
  status: string;
};

type ProfileNameRow = { id: string; full_name: string | null };

export function ClientDocumentsPanel({
  userId,
  supabase,
  requestAgentId,
  requestAgentName,
  requestedTypes,
  onClearRequestParams,
}: {
  userId: string;
  supabase: SupabaseClient;
  requestAgentId: string | null;
  requestAgentName: string | null;
  requestedTypes: ClientDocumentTypeKey[] | null;
  onClearRequestParams?: () => void;
}) {
  const [rows, setRows] = useState<ClientDocRow[]>([]);
  const [namesById, setNamesById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [sharingKey, setSharingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_documents")
      .select("id, document_type, file_url, file_name, shared_with, status")
      .eq("client_id", userId);

    if (error) {
      console.error(error);
      toast.error(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as ClientDocRow[];
    setRows(list);

    const allIds = new Set<string>();
    for (const r of list) {
      for (const u of r.shared_with ?? []) {
        if (u) allIds.add(u);
      }
    }
    if (requestAgentId) allIds.add(requestAgentId);

    if (allIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", [...allIds]);
      const map: Record<string, string> = {};
      for (const p of (profs ?? []) as ProfileNameRow[]) {
        map[p.id] = p.full_name?.trim() || "Agent";
      }
      setNamesById(map);
    } else {
      setNamesById({});
    }

    setLoading(false);
  }, [supabase, userId, requestAgentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rowByType = useMemo(() => {
    const m = new Map<string, ClientDocRow>();
    for (const r of rows) m.set(r.document_type, r);
    return m;
  }, [rows]);

  const uploadFile = async (documentType: ClientDocumentTypeKey, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be 10MB or smaller.");
      return;
    }
    setUploadingKey(documentType);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("document_type", documentType);
      const res = await fetch("/api/client/upload-document", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed");
        return;
      }
      toast.success("Document uploaded");
      await load();
    } finally {
      setUploadingKey(null);
    }
  };

  const shareWithAgent = async (documentType: ClientDocumentTypeKey) => {
    if (!requestAgentId) return;
    setSharingKey(documentType);
    try {
      const res = await fetch("/api/client/share-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agent_user_id: requestAgentId,
          document_types: [documentType],
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not share");
        return;
      }
      toast.success("Shared with your agent");
      await load();
    } finally {
      setSharingKey(null);
    }
  };

  const showRequestBanner =
    Boolean(requestAgentId && requestAgentName && requestedTypes && requestedTypes.length > 0);

  return (
    <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
      <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">My Documents</h2>
      <p className="mt-1 text-sm text-[#2C2C2C]/55">
        Upload documents to share with agents when requested
      </p>

      {showRequestBanner ? (
        <div className="mt-6 rounded-xl border border-[#6B9E6E]/35 bg-[#6B9E6E]/10 px-4 py-3 text-sm text-[#2C2C2C]">
          <p className="font-semibold">
            Agent {requestAgentName} has requested your documents. Select which to share below.
          </p>
          {onClearRequestParams ? (
            <button
              type="button"
              onClick={onClearRequestParams}
              className="mt-2 text-xs font-semibold text-[#6B9E6E] underline"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm font-semibold text-[#2C2C2C]/45">Loading…</p>
      ) : (
        <div className="mt-8 space-y-6">
          {CLIENT_DOCUMENT_TYPES.map(({ key, label }) => {
            const row = rowByType.get(key);
            const isRequested = requestedTypes?.includes(key as ClientDocumentTypeKey) ?? false;
            const sharedNames = (row?.shared_with ?? [])
              .map((id) => namesById[id] ?? id.slice(0, 8))
              .filter(Boolean);

            return (
              <div key={key} className="border-b border-[#2C2C2C]/10 pb-6 last:border-0 last:pb-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#2C2C2C]/50">
                  {label}
                </p>

                {row ? (
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#2C2C2C]">
                        {row.file_name ?? row.file_url}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
                          Uploaded ✓
                        </span>
                        <span className="text-xs text-[#2C2C2C]/55">
                          {row.status === "shared" ? "Shared" : "Private"}
                          {sharedNames.length > 0 ? ` · ${sharedNames.join(", ")}` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer rounded-full border border-[#2C2C2C]/15 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] hover:bg-[#FAF8F4]">
                        Replace
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="sr-only"
                          disabled={uploadingKey === key}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) void uploadFile(key, f);
                          }}
                        />
                      </label>
                      {isRequested && requestAgentId && requestAgentName ? (
                        <button
                          type="button"
                          disabled={
                            sharingKey === key ||
                            (row.shared_with ?? []).includes(requestAgentId)
                          }
                          onClick={() => void shareWithAgent(key)}
                          className="rounded-full bg-[#6B9E6E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5d8a60] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {(row.shared_with ?? []).includes(requestAgentId)
                            ? `Shared with ${requestAgentName}`
                            : `Share with ${requestAgentName}`}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <label
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const f = e.dataTransfer.files?.[0];
                      if (f) void uploadFile(key, f);
                    }}
                    className={cn(
                      "mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#2C2C2C]/20 bg-[#FAF8F4]/50 px-4 py-8 text-center transition hover:border-[#6B9E6E]/50",
                      uploadingKey === key && "pointer-events-none opacity-60",
                    )}
                  >
                    <span className="text-sm font-semibold text-[#2C2C2C]/70">
                      Drag and drop or click to browse
                    </span>
                    <span className="mt-1 text-xs text-[#2C2C2C]/45">Images or PDF · max 10MB</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      disabled={uploadingKey === key}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) void uploadFile(key, f);
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function parseClientDocRequestParams(searchParams: URLSearchParams): {
  requestAgentId: string | null;
  requestAgentName: string | null;
  requestedTypes: ClientDocumentTypeKey[] | null;
} {
  const reqAgent = searchParams.get("reqAgent");
  const reqTypesRaw = searchParams.get("reqTypes");
  const reqAgentName = searchParams.get("reqAgentName");

  if (!reqAgent?.trim() || !reqTypesRaw?.trim()) {
    return { requestAgentId: null, requestAgentName: null, requestedTypes: null };
  }

  const types = reqTypesRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ClientDocumentTypeKey => isClientDocumentType(s));

  return {
    requestAgentId: reqAgent.trim(),
    requestAgentName: reqAgentName?.trim() || null,
    requestedTypes: types.length ? types : null,
  };
}

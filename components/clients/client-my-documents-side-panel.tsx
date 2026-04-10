"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  CLIENT_DOCUMENT_TYPES,
  type ClientDocumentTypeKey,
  labelForClientDocType,
} from "@/lib/client-documents";
import { useDataConsentGate } from "@/components/legal/data-consent-modal";
import {
  parseClientDocRequestParams,
  type ClientDocRow,
} from "@/components/settings/client-documents-panel";

type ProfileNameRow = { id: string; full_name: string | null };

export function ClientMyDocumentsSidePanel({
  open,
  onClose,
  userId,
  supabase,
  searchParams,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  supabase: SupabaseClient;
  searchParams: URLSearchParams;
}) {
  const docRequest = useMemo(() => parseClientDocRequestParams(searchParams), [searchParams]);
  const [rows, setRows] = useState<ClientDocRow[]>([]);
  const [namesById, setNamesById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [viewBusyId, setViewBusyId] = useState<string | null>(null);
  const [deleteConfirmType, setDeleteConfirmType] = useState<ClientDocumentTypeKey | null>(null);
  const [unshareBusy, setUnshareBusy] = useState<string | null>(null);
  const { ensureConsent, dataConsentModal } = useDataConsentGate();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_documents")
      .select("id, document_type, file_url, file_name, shared_with, status, created_at")
      .eq("client_id", userId);

    if (error) {
      console.error(error);
      toast.error(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as (ClientDocRow & { created_at?: string })[];
    setRows(list as ClientDocRow[]);

    const allIds = new Set<string>();
    for (const r of list) {
      for (const u of r.shared_with ?? []) {
        if (u) allIds.add(u);
      }
    }
    if (docRequest.requestAgentId) allIds.add(docRequest.requestAgentId);

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
  }, [supabase, userId, docRequest.requestAgentId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const rowByType = useMemo(() => {
    const m = new Map<string, ClientDocRow & { created_at?: string }>();
    for (const r of rows) m.set(r.document_type, r as ClientDocRow & { created_at?: string });
    return m;
  }, [rows]);

  const uploadWithProgress = (documentType: ClientDocumentTypeKey, file: File) => {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("document_type", documentType);
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/client/upload-document");
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadPct(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        resolve(
          new Response(xhr.responseText, {
            status: xhr.status,
            headers: { "Content-Type": xhr.getResponseHeader("Content-Type") || "application/json" },
          }),
        );
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(fd);
    });
  };

  const runUpload = async (documentType: ClientDocumentTypeKey, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be 10MB or smaller.");
      return;
    }
    setUploadingKey(documentType);
    setUploadPct(0);
    try {
      const res = await uploadWithProgress(documentType, file);
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed");
        return;
      }
      toast.success("Document uploaded");
      await load();
    } finally {
      setUploadingKey(null);
      setUploadPct(0);
    }
  };

  const uploadFile = (documentType: ClientDocumentTypeKey, file: File) => {
    ensureConsent(() => void runUpload(documentType, file));
  };

  const viewDocument = async (fileUrl: string) => {
    setViewBusyId(fileUrl);
    try {
      const res = await fetch("/api/client/get-document-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ file_url: fileUrl }),
      });
      const json = (await res.json().catch(() => ({}))) as { signedUrl?: string; error?: string };
      if (!res.ok || !json.signedUrl) {
        toast.error(json.error ?? "Could not open document");
        return;
      }
      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setViewBusyId(null);
    }
  };

  const deleteDocument = async (documentType: ClientDocumentTypeKey) => {
    const res = await fetch("/api/client/delete-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ document_type: documentType }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error(json.error ?? "Could not delete");
      return;
    }
    toast.success("Document removed");
    setDeleteConfirmType(null);
    await load();
  };

  const unshare = async (documentType: ClientDocumentTypeKey, agentUserId: string) => {
    setUnshareBusy(`${documentType}:${agentUserId}`);
    try {
      const res = await fetch("/api/client/unshare-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ document_type: documentType, agent_user_id: agentUserId }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not unshare");
        return;
      }
      toast.success("Sharing updated");
      await load();
    } finally {
      setUnshareBusy(null);
    }
  };

  return (
    <>
      {dataConsentModal}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex justify-end bg-black/30"
            onClick={onClose}
          >
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-full w-96 max-w-[100vw] flex-col bg-white shadow-xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#2C2C2C]/10 px-4 py-3">
                <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">My Documents</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-[#2C2C2C]/60 hover:bg-[#FAF8F4]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {loading ? (
                  <p className="text-sm font-semibold text-[#2C2C2C]/45">Loading…</p>
                ) : (
                  <div className="space-y-6">
                    {CLIENT_DOCUMENT_TYPES.map(({ key, label }) => {
                      const row = rowByType.get(key);
                      const uploadedAt = row?.created_at
                        ? new Date(row.created_at).toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })
                        : null;

                      return (
                        <div key={key} className="border-b border-[#2C2C2C]/10 pb-6 last:border-0 last:pb-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#2C2C2C]/50">
                            {label}
                          </p>

                          {!row ? (
                            <div className="mt-2">
                              <p className="text-sm text-[#2C2C2C]/45">Not uploaded</p>
                              <label className="mt-2 inline-flex cursor-pointer rounded-xl bg-[#6B9E6E] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5d8a60] disabled:opacity-50">
                                {uploadingKey === key ? `Uploading… ${uploadPct}%` : "Upload"}
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="sr-only"
                                  disabled={uploadingKey !== null}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = "";
                                    if (f) uploadFile(key, f);
                                  }}
                                />
                              </label>
                            </div>
                          ) : (
                            <div className="mt-2 space-y-2">
                              <p className="truncate text-sm font-semibold text-[#2C2C2C]">
                                {row.file_name ?? row.file_url}
                              </p>
                              {uploadedAt ? (
                                <p className="text-xs text-[#2C2C2C]/55">Uploaded {uploadedAt}</p>
                              ) : null}
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={viewBusyId === row.file_url}
                                  onClick={() => void viewDocument(row.file_url)}
                                  className="rounded-lg border border-[#2C2C2C]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C] hover:bg-gray-50 disabled:opacity-50"
                                >
                                  {viewBusyId === row.file_url ? "…" : "View"}
                                </button>
                                <label className="cursor-pointer rounded-lg border border-[#2C2C2C]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#2C2C2C] hover:bg-gray-50">
                                  Replace
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="sr-only"
                                    disabled={uploadingKey !== null}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      e.target.value = "";
                                      if (f) uploadFile(key, f);
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmType(key)}
                                  className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </div>

                              {(row.shared_with?.length ?? 0) > 0 ? (
                                <div className="mt-3 rounded-lg border border-[#2C2C2C]/10 bg-[#FAF8F4]/80 p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                                    Shared with
                                  </p>
                                  <ul className="mt-2 space-y-2">
                                    {(row.shared_with ?? []).map((aid) => (
                                      <li
                                        key={aid}
                                        className="flex items-center justify-between gap-2 text-sm"
                                      >
                                        <span className="font-medium text-[#2C2C2C]">
                                          {namesById[aid] ?? aid.slice(0, 8)}
                                        </span>
                                        <button
                                          type="button"
                                          disabled={unshareBusy === `${key}:${aid}`}
                                          onClick={() => void unshare(key, aid)}
                                          className="shrink-0 text-xs font-semibold text-[#6B9E6E] underline disabled:opacity-50"
                                        >
                                          Unshare
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}

                              {deleteConfirmType === key ? (
                                <div className="mt-3 rounded-lg border border-red-200 bg-red-50/80 p-3">
                                  <p className="text-sm font-semibold text-[#2C2C2C]">
                                    Delete this document?
                                  </p>
                                  <div className="mt-2 flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void deleteDocument(key)}
                                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmType(null)}
                                      className="rounded-lg border border-[#2C2C2C]/15 px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]"
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

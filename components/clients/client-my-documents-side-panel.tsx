"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  CLIENT_DOCUMENT_TYPES,
  type ClientDocumentTypeKey,
  isClientDocumentType,
  labelForClientDocType,
} from "@/lib/client-documents";
import { useDataConsentGate } from "@/components/legal/data-consent-modal";
import {
  parseClientDocRequestParams,
  type ClientDocRow,
} from "@/components/settings/client-documents-panel";

type ProfileNameRow = { id: string; full_name: string | null };

type TabId = "my-docs" | "from-agent" | "history";

type NotificationRow = {
  id: string;
  created_at: string;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
};

function parseReqTypesFromLink(link: unknown): string[] {
  if (typeof link !== "string" || !link.trim()) return [];
  try {
    const u = new URL(link, "https://local.invalid");
    const raw = u.searchParams.get("reqTypes");
    if (!raw) return [];
    return decodeURIComponent(raw)
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is string => Boolean(s && isClientDocumentType(s)));
  } catch {
    return [];
  }
}

function propertyLabel(
  name: string | null | undefined,
  location: string | null | undefined,
): string {
  const n = name?.trim();
  const l = location?.trim();
  if (n && l) return `${n} · ${l}`;
  return n || l || "Property inquiry";
}

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
  const docRequest = useMemo(
    () => parseClientDocRequestParams(searchParams),
    [searchParams],
  );
  const [tab, setTab] = useState<TabId>("my-docs");

  const [rows, setRows] = useState<ClientDocRow[]>([]);
  const [namesById, setNamesById] = useState<Record<string, string>>({});
  const [loadingDocs, setLoadingDocs] = useState(true);

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [leadInfoById, setLeadInfoById] = useState<
    Record<string, { propertyLabel: string; agentId: string | null }>
  >({});
  const [loadingFromAgent, setLoadingFromAgent] = useState(false);

  const [historyEntries, setHistoryEntries] = useState<
    { id: string; created_at: string; message: string }[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [viewBusyId, setViewBusyId] = useState<string | null>(null);
  const [deleteConfirmType, setDeleteConfirmType] =
    useState<ClientDocumentTypeKey | null>(null);
  const [unshareBusy, setUnshareBusy] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState<string | null>(null);
  const [uploadShareBusy, setUploadShareBusy] = useState<string | null>(null);
  const [sendBackBusy, setSendBackBusy] = useState<string | null>(null);
  const [pendingSendFile, setPendingSendFile] = useState<
    Record<string, File | null>
  >({});

  const { ensureConsent, dataConsentModal } = useDataConsentGate();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (
      open &&
      docRequest.requestAgentId &&
      docRequest.requestedTypes?.length
    ) {
      setTab("from-agent");
    }
  }, [open, docRequest.requestAgentId, docRequest.requestedTypes]);

  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    const { data, error } = await supabase
      .from("client_documents")
      .select(
        "id, document_type, file_url, file_name, shared_with, status, created_at",
      )
      .eq("client_id", userId);

    if (error) {
      console.error(error);
      toast.error(error.message);
      setRows([]);
      setLoadingDocs(false);
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

    setLoadingDocs(false);
  }, [supabase, userId, docRequest.requestAgentId]);

  const loadFromAgent = useCallback(async () => {
    setLoadingFromAgent(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, created_at, type, title, body, metadata")
      .eq("user_id", userId)
      .in("type", ["document_request", "document_shared"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
      toast.error(error.message);
      setNotifications([]);
      setLoadingFromAgent(false);
      return;
    }

    const list = (data ?? []) as NotificationRow[];
    setNotifications(list);

    const leadIds = new Set<number>();
    for (const n of list) {
      const m = n.metadata;
      if (!m || typeof m !== "object") continue;
      const lid = (m as { lead_id?: unknown }).lead_id;
      if (typeof lid === "number" && Number.isFinite(lid)) leadIds.add(lid);
      else if (typeof lid === "string" && /^\d+$/.test(lid))
        leadIds.add(parseInt(lid, 10));
    }

    if (leadIds.size === 0) {
      setLeadInfoById({});
      setLoadingFromAgent(false);
      return;
    }

    const ids = [...leadIds];
    const { data: leads } = await supabase
      .from("leads")
      .select("id, property_id, agent_id")
      .in("id", ids);

    const propIds = [
      ...new Set(
        (leads ?? [])
          .map((l) => (l as { property_id?: string | null }).property_id)
          .filter((x): x is string => Boolean(x)),
      ),
    ];

    let propsById: Record<
      string,
      { name: string | null; location: string | null }
    > = {};
    if (propIds.length > 0) {
      const { data: props } = await supabase
        .from("properties")
        .select("id, name, location")
        .in("id", propIds);
      for (const p of (props ?? []) as {
        id: string;
        name: string | null;
        location: string | null;
      }[]) {
        propsById[p.id] = { name: p.name, location: p.location };
      }
    }

    const map: Record<
      string,
      { propertyLabel: string; agentId: string | null }
    > = {};
    for (const l of (leads ?? []) as {
      id: number;
      property_id: string | null;
      agent_id: string | null;
    }[]) {
      const pid = l.property_id;
      const pl =
        pid && propsById[pid]
          ? propertyLabel(propsById[pid].name, propsById[pid].location)
          : "Property inquiry";
      map[String(l.id)] = { propertyLabel: pl, agentId: l.agent_id };
    }
    setLeadInfoById(map);
    setLoadingFromAgent(false);
  }, [supabase, userId]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const res = await fetch("/api/client/document-activity", {
      credentials: "include",
    });
    const json = (await res.json().catch(() => ({}))) as {
      entries?: { id: string; created_at: string; message: string }[];
      error?: string;
    };
    if (!res.ok) {
      toast.error(json.error ?? "Could not load activity");
      setHistoryEntries([]);
    } else {
      setHistoryEntries(json.entries ?? []);
    }
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadDocs();
  }, [open, loadDocs]);

  useEffect(() => {
    if (!open || tab !== "from-agent") return;
    void loadFromAgent();
  }, [open, tab, loadFromAgent]);

  useEffect(() => {
    if (!open || tab !== "history") return;
    void loadHistory();
  }, [open, tab, loadHistory]);

  const rowByType = useMemo(() => {
    const m = new Map<string, ClientDocRow & { created_at?: string }>();
    for (const r of rows)
      m.set(r.document_type, r as ClientDocRow & { created_at?: string });
    return m;
  }, [rows]);

  const uploadWithProgress = (
    documentType: ClientDocumentTypeKey,
    file: File,
  ) => {
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
            headers: {
              "Content-Type":
                xhr.getResponseHeader("Content-Type") || "application/json",
            },
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
      await loadDocs();
    } finally {
      setUploadingKey(null);
      setUploadPct(0);
    }
  };

  const uploadFile = (documentType: ClientDocumentTypeKey, file: File) => {
    ensureConsent(() => void runUpload(documentType, file));
  };

  const shareWithAgent = async (
    agentUserId: string,
    documentTypes: ClientDocumentTypeKey[],
  ) => {
    const key = `${agentUserId}:${documentTypes.join(",")}`;
    setShareBusy(key);
    try {
      const res = await fetch("/api/client/share-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          agent_user_id: agentUserId,
          document_types: documentTypes,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not share");
        return;
      }
      toast.success("Shared with agent");
      await loadDocs();
      await loadFromAgent();
      await loadHistory();
    } finally {
      setShareBusy(null);
    }
  };

  const uploadAndShare = (
    agentUserId: string,
    documentType: ClientDocumentTypeKey,
    file: File,
  ) => {
    ensureConsent(async () => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File must be 10MB or smaller.");
        return;
      }
      const key = `${agentUserId}:${documentType}`;
      setUploadShareBusy(key);
      setUploadingKey(documentType);
      setUploadPct(0);
      try {
        const res = await uploadWithProgress(documentType, file);
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast.error(json.error ?? "Upload failed");
          return;
        }
        const shareRes = await fetch("/api/client/share-documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            agent_user_id: agentUserId,
            document_types: [documentType],
          }),
        });
        const shareJson = (await shareRes.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!shareRes.ok) {
          toast.error(shareJson.error ?? "Could not share");
          return;
        }
        toast.success("Uploaded and shared");
        await loadDocs();
        await loadFromAgent();
        await loadHistory();
      } finally {
        setUploadShareBusy(null);
        setUploadingKey(null);
        setUploadPct(0);
      }
    });
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
      const json = (await res.json().catch(() => ({}))) as {
        signedUrl?: string;
        error?: string;
      };
      if (!res.ok || !json.signedUrl) {
        toast.error(json.error ?? "Could not open document");
        return;
      }
      window.open(json.signedUrl, "_blank", "noopener,noreferrer");
      await loadHistory();
    } finally {
      setViewBusyId(null);
    }
  };

  const viewSignedUrl = (signedUrl: string) => {
    window.open(signedUrl, "_blank", "noopener,noreferrer");
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
    await loadDocs();
    await loadHistory();
  };

  const unshare = async (
    documentType: ClientDocumentTypeKey,
    agentUserId: string,
  ) => {
    setUnshareBusy(`${documentType}:${agentUserId}`);
    try {
      const res = await fetch("/api/client/unshare-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          document_type: documentType,
          agent_user_id: agentUserId,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Could not unshare");
        return;
      }
      toast.success("Sharing updated");
      await loadDocs();
      await loadHistory();
    } finally {
      setUnshareBusy(null);
    }
  };

  const sendDocumentToAgent = (
    notifId: string,
    agentUserId: string,
    leadId: number | null,
    file: File,
  ) => {
    ensureConsent(async () => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File must be 10MB or smaller.");
        return;
      }
      setSendBackBusy(notifId);
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("agent_user_id", agentUserId);
        if (leadId != null) fd.set("lead_id", String(leadId));
        const res = await fetch("/api/client/send-document-to-agent", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast.error(json.error ?? "Could not send");
          return;
        }
        toast.success("Document sent");
        setPendingSendFile((p) => ({ ...p, [notifId]: null }));
        await loadFromAgent();
        await loadHistory();
      } finally {
        setSendBackBusy(null);
      }
    });
  };

  const requestNotifications = notifications.filter(
    (n) => n.type === "document_request",
  );
  const sharedNotifications = notifications.filter(
    (n) => n.type === "document_shared",
  );

  return (
    <>
      {dataConsentModal}
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              key="doc-center-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40"
              onClick={onClose}
            />
            <motion.aside
              key="doc-center-panel"
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="fixed right-0 top-0 z-50 h-screen w-[min(100vw,420px)] overflow-y-auto bg-white shadow-2xl"
            >
              <div className="relative border-b border-gray-100 px-5 pb-4 pt-5">
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-50"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
                <h2 className="pr-10 font-serif text-xl text-[#2C2C2C]">
                  Document Center
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Manage and share your documents
                </p>

                <div className="mt-5 flex gap-6 border-b border-gray-100">
                  {(
                    [
                      ["my-docs", "My Docs"],
                      ["from-agent", "From Agent"],
                      ["history", "History"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={`pb-2 text-sm font-medium transition-colors ${
                        tab === id
                          ? "border-b-2 border-[#6B9E6E] text-[#6B9E6E]"
                          : "border-b-2 border-transparent text-gray-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-5 py-4">
                {tab === "my-docs" ? (
                  <div>
                    {loadingDocs ? (
                      <p className="text-sm text-gray-400">Loading…</p>
                    ) : (
                      <>
                        {uploadingKey ? (
                          <div className="mb-4">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full bg-[#6B9E6E] transition-all"
                                style={{ width: `${uploadPct}%` }}
                              />
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                              Uploading… {uploadPct}%
                            </p>
                          </div>
                        ) : null}
                        {CLIENT_DOCUMENT_TYPES.map(({ key, label }) => {
                          const row = rowByType.get(key);
                          const uploadedAt = row?.created_at
                            ? new Date(row.created_at).toLocaleDateString(
                                undefined,
                                {
                                  dateStyle: "medium",
                                },
                              )
                            : null;

                          return (
                            <div key={key} className="mb-3">
                              {!row ? (
                                <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 text-center">
                                  <p className="mb-1 text-sm font-medium text-[#2C2C2C]">
                                    {label}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    No document uploaded
                                  </p>
                                  <label className="mt-3 inline-flex cursor-pointer rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-medium text-white hover:bg-[#5d8a60] disabled:opacity-50">
                                    {uploadingKey === key
                                      ? `Uploading… ${uploadPct}%`
                                      : "Upload"}
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
                                <div className="rounded-xl border border-gray-100 p-4">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-sm font-medium text-[#2C2C2C]">
                                      {label}
                                    </span>
                                    <span className="rounded-full bg-[#6B9E6E]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B9E6E]">
                                      Uploaded
                                    </span>
                                  </div>
                                  <p className="mt-1 truncate text-xs text-gray-400">
                                    {row.file_name ?? row.file_url}
                                  </p>
                                  {uploadedAt ? (
                                    <p className="mt-0.5 text-xs text-gray-300">
                                      {uploadedAt}
                                    </p>
                                  ) : null}
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={viewBusyId === row.file_url}
                                      onClick={() =>
                                        void viewDocument(row.file_url)
                                      }
                                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-[#2C2C2C] hover:bg-gray-50 disabled:opacity-50"
                                    >
                                      {viewBusyId === row.file_url
                                        ? "…"
                                        : "View"}
                                    </button>
                                    <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-[#2C2C2C] hover:bg-gray-50">
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
                                      className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                    >
                                      Delete
                                    </button>
                                  </div>

                                  {(row.shared_with?.length ?? 0) > 0 ? (
                                    <div className="mt-3 border-t border-gray-50 pt-3">
                                      <p className="text-xs text-gray-400">
                                        Shared with:{" "}
                                        {(row.shared_with ?? [])
                                          .map(
                                            (aid) => namesById[aid] ?? "Agent",
                                          )
                                          .join(", ")}
                                      </p>
                                      <ul className="mt-2 space-y-1">
                                        {(row.shared_with ?? []).map((aid) => (
                                          <li
                                            key={aid}
                                            className="flex items-center justify-between gap-2"
                                          >
                                            <span className="text-xs text-gray-500">
                                              {namesById[aid] ??
                                                aid.slice(0, 8)}
                                            </span>
                                            <button
                                              type="button"
                                              disabled={
                                                unshareBusy === `${key}:${aid}`
                                              }
                                              onClick={() =>
                                                void unshare(key, aid)
                                              }
                                              className="text-xs font-medium text-red-400 hover:underline disabled:opacity-50"
                                            >
                                              Unshare
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}

                                  {deleteConfirmType === key ? (
                                    <div className="mt-3 rounded-lg border border-red-100 bg-red-50/50 p-3">
                                      <p className="text-sm font-medium text-[#2C2C2C]">
                                        Delete this document?
                                      </p>
                                      <div className="mt-2 flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void deleteDocument(key)
                                          }
                                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                                        >
                                          Yes
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setDeleteConfirmType(null)
                                          }
                                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]"
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
                      </>
                    )}
                  </div>
                ) : null}

                {tab === "from-agent" ? (
                  <div>
                    {docRequest.requestAgentId &&
                    docRequest.requestAgentName ? (
                      <div className="mb-4 rounded-xl border border-[#6B9E6E]/30 bg-[#6B9E6E]/5 px-3 py-2 text-sm text-[#2C2C2C]">
                        <span className="font-semibold">
                          {docRequest.requestAgentName}
                        </span>{" "}
                        requested documents — respond below.
                      </div>
                    ) : null}

                    <h3 className="font-serif text-lg font-semibold text-[#2C2C2C]">
                      Documents from your agents
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Review and respond to agent requests
                    </p>

                    {loadingFromAgent ? (
                      <p className="mt-6 text-sm text-gray-400">Loading…</p>
                    ) : (
                      <>
                        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Requested from you
                        </p>
                        {requestNotifications.length === 0 ? (
                          <p className="mt-2 text-sm text-gray-400">
                            No pending requests
                          </p>
                        ) : (
                          requestNotifications.map((n) => {
                            const m = (n.metadata ?? {}) as {
                              link?: unknown;
                              lead_id?: unknown;
                              agent_user_id?: unknown;
                              document_types?: unknown;
                            };
                            const link =
                              typeof m.link === "string" ? m.link : "";
                            const typesFromMeta = m.document_types;
                            const types = Array.isArray(typesFromMeta)
                              ? typesFromMeta
                                  .map((t) =>
                                    typeof t === "string" ? t.trim() : "",
                                  )
                                  .filter((t): t is ClientDocumentTypeKey =>
                                    isClientDocumentType(t),
                                  )
                              : parseReqTypesFromLink(link);
                            const leadIdRaw = m.lead_id;
                            const leadId =
                              typeof leadIdRaw === "number"
                                ? leadIdRaw
                                : typeof leadIdRaw === "string" &&
                                    /^\d+$/.test(leadIdRaw)
                                  ? parseInt(leadIdRaw, 10)
                                  : null;
                            const agentUserId =
                              typeof m.agent_user_id === "string"
                                ? m.agent_user_id.trim()
                                : "";
                            const leadKey =
                              leadId != null ? String(leadId) : "";
                            const info = leadKey
                              ? leadInfoById[leadKey]
                              : undefined;
                            const propertyName = info?.propertyLabel ?? "—";

                            return (
                              <div
                                key={n.id}
                                className="mt-3 rounded-xl border border-gray-200 p-4"
                              >
                                <p className="font-medium text-[#2C2C2C]">
                                  {n.title}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                  {propertyName}
                                </p>
                                {n.body ? (
                                  <p className="mt-1 text-xs text-gray-400">
                                    {n.body}
                                  </p>
                                ) : null}
                                <p className="mt-2 text-xs text-gray-300">
                                  {new Date(n.created_at).toLocaleString(
                                    undefined,
                                    {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    },
                                  )}
                                </p>
                                {!agentUserId ? (
                                  <p className="mt-2 text-xs text-amber-700">
                                    Missing agent reference.
                                  </p>
                                ) : types.length === 0 ? (
                                  <p className="mt-2 text-xs text-gray-400">
                                    Open the link in this notification email or
                                    refresh — requested document types could not
                                    be loaded.
                                  </p>
                                ) : (
                                  <ul className="mt-3 space-y-2">
                                    {types
                                      .filter(
                                        (dt): dt is ClientDocumentTypeKey =>
                                          isClientDocumentType(dt),
                                      )
                                      .map((dt) => {
                                        const docRow = rowByType.get(dt);
                                        const busyShare =
                                          shareBusy === `${agentUserId}:${dt}`;
                                        const busyUp =
                                          uploadShareBusy ===
                                          `${agentUserId}:${dt}`;
                                        return (
                                          <li
                                            key={dt}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2"
                                          >
                                            <span className="text-sm text-[#2C2C2C]">
                                              {labelForClientDocType(dt)}
                                            </span>
                                            {docRow ? (
                                              <button
                                                type="button"
                                                disabled={busyShare}
                                                onClick={() =>
                                                  void shareWithAgent(
                                                    agentUserId,
                                                    [dt],
                                                  )
                                                }
                                                className="rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5d8a60] disabled:opacity-50"
                                              >
                                                {busyShare
                                                  ? "…"
                                                  : "Share with agent"}
                                              </button>
                                            ) : (
                                              <label className="cursor-pointer rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5d8a60] disabled:opacity-50">
                                                {busyUp
                                                  ? "…"
                                                  : "Upload & Share"}
                                                <input
                                                  type="file"
                                                  accept="image/*,application/pdf"
                                                  className="sr-only"
                                                  disabled={
                                                    busyUp ||
                                                    uploadingKey !== null
                                                  }
                                                  onChange={(e) => {
                                                    const f =
                                                      e.target.files?.[0];
                                                    e.target.value = "";
                                                    if (f)
                                                      uploadAndShare(
                                                        agentUserId,
                                                        dt,
                                                        f,
                                                      );
                                                  }}
                                                />
                                              </label>
                                            )}
                                          </li>
                                        );
                                      })}
                                  </ul>
                                )}
                              </div>
                            );
                          })
                        )}

                        <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Sent to you
                        </p>
                        {sharedNotifications.length === 0 ? (
                          <p className="mt-2 text-sm text-gray-400">
                            No documents from agents yet
                          </p>
                        ) : (
                          sharedNotifications.map((n) => {
                            const m = (n.metadata ?? {}) as {
                              file_url?: unknown;
                              file_name?: unknown;
                              lead_id?: unknown;
                              agent_name?: unknown;
                              deal_document_id?: unknown;
                            };
                            const fileUrl =
                              typeof m.file_url === "string"
                                ? m.file_url.trim()
                                : "";
                            const fileName =
                              typeof m.file_name === "string"
                                ? m.file_name
                                : "Document";
                            const leadIdRaw = m.lead_id;
                            const leadId =
                              typeof leadIdRaw === "number"
                                ? leadIdRaw
                                : typeof leadIdRaw === "string" &&
                                    /^\d+$/.test(leadIdRaw)
                                  ? parseInt(leadIdRaw, 10)
                                  : null;
                            const leadKey =
                              leadId != null ? String(leadId) : "";
                            const info = leadKey
                              ? leadInfoById[leadKey]
                              : undefined;
                            const agentUserId = info?.agentId ?? "";
                            const agentName =
                              typeof m.agent_name === "string" &&
                              m.agent_name.trim()
                                ? m.agent_name.trim()
                                : "Your agent";

                            return (
                              <div
                                key={n.id}
                                className="mt-3 rounded-xl border border-gray-200 p-4"
                              >
                                <p className="font-medium text-[#2C2C2C]">
                                  {n.title}
                                </p>
                                <p className="mt-1 text-sm text-gray-600">
                                  {agentName} · {fileName}
                                </p>
                                <p className="mt-2 text-xs text-gray-300">
                                  {new Date(n.created_at).toLocaleString(
                                    undefined,
                                    {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    },
                                  )}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {fileUrl ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => viewSignedUrl(fileUrl)}
                                        className="rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#5d8a60]"
                                      >
                                        View Document
                                      </button>
                                      <a
                                        href={fileUrl}
                                        download={fileName}
                                        className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-[#2C2C2C] hover:bg-gray-50"
                                      >
                                        Download
                                      </a>
                                    </>
                                  ) : (
                                    <p className="text-xs text-gray-400">
                                      No preview link available
                                    </p>
                                  )}
                                </div>

                                {agentUserId ? (
                                  <div className="mt-4 border-t border-gray-100 pt-4">
                                    <p className="text-sm font-medium text-[#2C2C2C]">
                                      Send a document back
                                    </p>
                                    <p className="mt-1 text-xs text-gray-400">
                                      Any file type, max 10MB
                                    </p>
                                    <input
                                      type="file"
                                      className="mt-2 w-full text-xs text-gray-600 file:mr-2 file:rounded-full file:border-0 file:bg-gray-100 file:px-3 file:py-1"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0] ?? null;
                                        e.target.value = "";
                                        setPendingSendFile((p) => ({
                                          ...p,
                                          [n.id]: f,
                                        }));
                                      }}
                                    />
                                    <button
                                      type="button"
                                      disabled={
                                        !pendingSendFile[n.id] ||
                                        sendBackBusy === n.id
                                      }
                                      onClick={() => {
                                        const f = pendingSendFile[n.id];
                                        if (f)
                                          sendDocumentToAgent(
                                            n.id,
                                            agentUserId,
                                            leadId,
                                            f,
                                          );
                                      }}
                                      className="mt-3 w-full rounded-full bg-[#6B9E6E] px-4 py-2 text-sm font-medium text-white hover:bg-[#5d8a60] disabled:opacity-50"
                                    >
                                      {sendBackBusy === n.id
                                        ? "Sending…"
                                        : `Send to ${agentName}`}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </>
                    )}
                  </div>
                ) : null}

                {tab === "history" ? (
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-[#2C2C2C]">
                      Document Activity
                    </h3>
                    {loadingHistory ? (
                      <p className="mt-4 text-sm text-gray-400">Loading…</p>
                    ) : historyEntries.length === 0 ? (
                      <p className="mt-4 text-sm text-gray-400">
                        No document activity yet
                      </p>
                    ) : (
                      <div className="relative mt-6 pl-4">
                        <div
                          className="absolute bottom-2 left-[7px] top-2 w-px bg-gray-200"
                          aria-hidden
                        />
                        <ul className="space-y-0">
                          {historyEntries.map((e) => (
                            <li key={e.id} className="relative pb-6 pl-4">
                              <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#6B9E6E]" />
                              <p className="text-sm text-[#2C2C2C]">
                                {e.message}
                              </p>
                              <p className="mt-1 text-xs text-gray-400">
                                {new Date(e.created_at).toLocaleString(
                                  undefined,
                                  {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  },
                                )}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

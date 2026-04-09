"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface Lead {
  /** bigint from PostgREST is often JSON-serialized as number */
  id: string | number;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  property_interest: string | null;
  message: string | null;
  stage?: string;
  /** @deprecated legacy column */
  status?: string;
}

interface Property {
  id: string;
  created_at: string;
  location: string;
  price: string;
  sqft: string;
  beds: number;
  baths: number;
  image_url: string;
  listed_by?: string | null;
}

interface PendingBroker {
  id: string;
  created_at: string;
  name: string;
  company_name: string;
  license_number: string;
  license_expiry: string | null;
  phone: string | null;
  email: string;
  website: string | null;
  bio: string | null;
  status: string;
}

interface PendingAgent {
  id: string;
  created_at: string;
  name: string;
  license_number: string;
  license_expiry: string | null;
  phone: string | null;
  email: string;
  bio: string | null;
  broker_id: string | null;
  status: string;
}

interface AdminUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  created_at: string;
  agent_verified: boolean | null;
  broker_verified: boolean | null;
  agent_id: string | null;
  broker_id: string | null;
  agent_status: string | null;
  broker_status: string | null;
}

interface AllAgentRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  license_number: string;
  score: number;
  closings: number;
  status: string;
  verified: boolean;
  verification_status?: string | null;
  broker_id: string | null;
  user_id: string;
  created_at: string;
  rejection_reason: string | null;
}

interface CoAgentRequestRow {
  id: string;
  created_at: string;
  status: string;
  property_id: string;
  agent_id: string;
  propertyName: string;
  propertyLocation: string;
  agentName: string;
}

interface PropertyConnectedAgent {
  id: string;
  name: string;
  email: string;
  status: string;
  verified: boolean | null;
}

interface PropertyAgentOption {
  id: string;
  name: string;
  email: string;
}

const emptyPropertyForm = {
  location: "",
  price: "",
  sqft: "",
  beds: "",
  baths: "",
  image_url: "",
};

const MASKED_PRC_DISPLAY = "PRC-AG-202*-*****";

function maskPrcForAdminQueue(_licenseNumber: string | null | undefined): string {
  return MASKED_PRC_DISPLAY;
}

function verificationColumnLabel(v: string | null | undefined): string {
  if (v === "verified") return "Verified";
  if (v === "pending") return "Pending Docs";
  if (v === "rejected") return "Rejected";
  if (v === "suspended") return "Suspended";
  return "Unverified";
}

function verificationColumnClass(v: string | null | undefined): string {
  if (v === "verified") return "text-emerald-700";
  if (v === "pending") return "text-amber-700";
  if (v === "rejected") return "text-red-700";
  if (v === "suspended") return "text-red-800";
  return "text-gray-500";
}

function docQueueBadgeClass(v: string | null | undefined): string {
  if (v === "pending") return "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900";
  if (v === "rejected") return "rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-900";
  return "rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700";
}

const DOC_REJECT_REASONS = [
  "Documents unclear or unreadable",
  "PRC number doesn't match uploaded ID",
  "Selfie does not match ID photo",
  "Expired license",
  "Other",
] as const;

const DOC_SUSPEND_REASONS = [
  "Fraudulent listing reported",
  "Multiple client complaints",
  "Impersonation suspected",
  "Platform policy violation",
  "Other",
] as const;

function formatVerificationErrorDetails(
  status: number,
  statusText: string,
  body: unknown,
): string {
  const payload =
    typeof body === "string"
      ? body
      : body === undefined || body === null
        ? "(empty body)"
        : JSON.stringify(body, null, 2);
  return [
    `HTTP ${status}${statusText ? ` ${statusText}` : ""}`,
    "",
    payload,
  ].join("\n");
}

export default function AdminPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [adminSection, setAdminSection] = useState<
    "leads" | "properties" | "verification" | "agents" | "users" | "coagent"
  >("leads");

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [propertyForm, setPropertyForm] = useState(emptyPropertyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [propertyError, setPropertyError] = useState("");
  const [propertySaving, setPropertySaving] = useState(false);

  const [pendingBrokers, setPendingBrokers] = useState<PendingBroker[]>([]);
  const [pendingAgents, setPendingAgents] = useState<PendingAgent[]>([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [rejectOpen, setRejectOpen] = useState<
    | { kind: "broker"; id: string }
    | { kind: "agent"; id: string }
    | null
  >(null);
  const [rejectReason, setRejectReason] = useState("");

  const [docReviewAgent, setDocReviewAgent] = useState<AllAgentRow | null>(null);
  const [docReviewUrls, setDocReviewUrls] = useState<{
    license_number: string;
    prc_signed_url: string | null;
    selfie_signed_url: string | null;
    has_documents: boolean;
  } | null>(null);
  const [docReviewLoading, setDocReviewLoading] = useState(false);
  const [docRejectReasonKey, setDocRejectReasonKey] = useState("");
  const [docRejectOtherText, setDocRejectOtherText] = useState("");
  const [docSuspendReasonKey, setDocSuspendReasonKey] = useState("");
  const [docSuspendOtherText, setDocSuspendOtherText] = useState("");
  const [docActionSaving, setDocActionSaving] = useState(false);

  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [allAgentsList, setAllAgentsList] = useState<AllAgentRow[]>([]);
  const [allAgentsLoading, setAllAgentsLoading] = useState(false);
  const [editAgent, setEditAgent] = useState<AllAgentRow | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    license_number: "",
    score: "",
    closings: "",
    status: "pending",
    broker_id: "",
  });

  const [coAgentRequests, setCoAgentRequests] = useState<CoAgentRequestRow[]>([]);
  const [coAgentLoading, setCoAgentLoading] = useState(false);
  const [coAgentError, setCoAgentError] = useState("");

  const [manageAgentsProperty, setManageAgentsProperty] = useState<Property | null>(null);
  const [manageAgentsConnected, setManageAgentsConnected] = useState<PropertyConnectedAgent[]>([]);
  const [manageAgentsAvailable, setManageAgentsAvailable] = useState<PropertyAgentOption[]>([]);
  const [manageAgentsLoading, setManageAgentsLoading] = useState(false);
  const [manageAgentsError, setManageAgentsError] = useState("");
  const [selectedAgentToAdd, setSelectedAgentToAdd] = useState("");
  const [manageAgentsMutating, setManageAgentsMutating] = useState(false);

  const documentQueueAgents = useMemo(() => {
    return allAgentsList.filter(
      (a) =>
        a.status === "approved" &&
        (a.verification_status === "pending" || a.verification_status === "rejected"),
    );
  }, [allAgentsList]);

  const [resetPasswordAgent, setResetPasswordAgent] = useState<AllAgentRow | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordSaving, setResetPasswordSaving] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/leads", { credentials: "include" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: Lead[];
      };
      if (json.success && Array.isArray(json.data)) setLeads(json.data);
      else setLeads([]);
    } catch {
      setLeads([]);
    }
    setLoading(false);
  };

  const fetchProperties = async () => {
    setPropertiesLoading(true);
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setPropertyError(error.message);
      setProperties([]);
    } else {
      setPropertyError("");
      setProperties((data as Property[]) ?? []);
    }
    setPropertiesLoading(false);
  };

  const fetchVerification = async () => {
    setVerificationLoading(true);
    setVerificationError("");
    const path = "/api/admin/verification";
    const absoluteUrl =
      typeof window !== "undefined"
        ? new URL(path, window.location.origin).href
        : path;
    const requestInit: RequestInit = {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    };
    console.log("[admin verification] fetch URL:", absoluteUrl);
    console.log("[admin verification] request headers:", {
      ...Object.fromEntries(new Headers(requestInit.headers).entries()),
      credentials: requestInit.credentials ?? "same-origin",
    });
    try {
      const res = await fetch(path, requestInit);
      const rawText = await res.text();
      let body: unknown = rawText;
      try {
        body = rawText ? JSON.parse(rawText) : null;
      } catch {
        /* non-JSON body */
      }
      type VerificationJson = {
        success?: boolean;
        data?: { brokers: PendingBroker[]; agents: PendingAgent[] };
        error?: { code?: string; message?: string; details?: unknown };
      };
      const json = body as VerificationJson;

      if (!res.ok) {
        console.error("[admin verification] error response:", {
          status: res.status,
          statusText: res.statusText,
          body,
        });
        setVerificationError(
          formatVerificationErrorDetails(res.status, res.statusText, body),
        );
        setPendingBrokers([]);
        setPendingAgents([]);
        return;
      }
      if (!json.success || !json.data) {
        console.error("[admin verification] error response:", {
          status: res.status,
          statusText: res.statusText,
          body,
        });
        setVerificationError(
          formatVerificationErrorDetails(res.status, res.statusText, body),
        );
        setPendingBrokers([]);
        setPendingAgents([]);
        return;
      }
      // Ensure any prior error is cleared on success.
      setVerificationError("");
      setPendingBrokers(json.data.brokers ?? []);
      setPendingAgents(json.data.agents ?? []);
    } catch (e) {
      console.error("[admin verification] fetch threw:", e);
      const msg =
        e instanceof Error
          ? `${e.name}: ${e.message}${e.stack ? `\n\n${e.stack}` : ""}`
          : String(e);
      setVerificationError(msg);
      setPendingBrokers([]);
      setPendingAgents([]);
    } finally {
      setVerificationLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    setUsersError("");
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const rawText = await res.text();
      let body: unknown = rawText;
      try {
        body = rawText ? JSON.parse(rawText) : null;
      } catch {
        /* non-JSON */
      }
      const json = body as { success?: boolean; data?: AdminUserRow[]; error?: { message?: string } };
      if (!res.ok) {
        setUsersError(json?.error?.message ?? `HTTP ${res.status}`);
        setAdminUsers([]);
        return;
      }
      if (json.success && Array.isArray(json.data)) setAdminUsers(json.data);
      else setAdminUsers([]);
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : "Failed to load users");
      setAdminUsers([]);
    }
    setUsersLoading(false);
  };

  const fetchAllAgents = async () => {
    setAllAgentsLoading(true);
    try {
      const res = await fetch("/api/admin/agents", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: AllAgentRow[];
      };
      if (json.success && Array.isArray(json.data)) setAllAgentsList(json.data);
      else setAllAgentsList([]);
    } catch {
      setAllAgentsList([]);
    }
    setAllAgentsLoading(false);
  };

  const fetchCoAgentRequests = async () => {
    setCoAgentLoading(true);
    setCoAgentError("");
    try {
      const res = await fetch("/api/admin/co-agent-requests", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: CoAgentRequestRow[];
        error?: { message?: string };
      };
      if (!res.ok) {
        setCoAgentError(json?.error?.message ?? `HTTP ${res.status}`);
        setCoAgentRequests([]);
        return;
      }
      if (json.success && Array.isArray(json.data)) setCoAgentRequests(json.data);
      else setCoAgentRequests([]);
    } catch (e) {
      setCoAgentError(e instanceof Error ? e.message : "Failed to load");
      setCoAgentRequests([]);
    }
    setCoAgentLoading(false);
  };

  const decideCoAgentRequest = async (id: string, decision: "approve" | "reject") => {
    const res = await fetch(`/api/admin/co-agent-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      alert(j?.error?.message ?? "Action failed");
      return;
    }
    void fetchCoAgentRequests();
  };

  const updateUserRole = async (id: string, role: string) => {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role }),
    });
    void fetchUsers();
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Delete this user and all related data? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      alert(j?.error?.message ?? "Delete failed");
      return;
    }
    void fetchUsers();
  };

  const deleteAgentRow = async (id: string) => {
    if (!confirm("Remove this agent registration from the database?")) return;
    const res = await fetch(`/api/admin/agents/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      alert("Could not delete agent");
      return;
    }
    void fetchAllAgents();
    void fetchVerification();
  };

  const openEditAgent = (a: AllAgentRow) => {
    setEditError("");
    setEditAgent(a);
    setEditForm({
      name: a.name,
      email: a.email,
      phone: a.phone ?? "",
      license_number: a.license_number,
      score: String(a.score ?? 0),
      closings: String(a.closings ?? 0),
      status: a.status,
      broker_id: a.broker_id ?? "",
    });
  };

  const saveEditAgent = async () => {
    if (!editAgent) return;
    const score = Number(editForm.score);
    if (!Number.isFinite(score)) {
      setEditError("Score must be a valid number");
      return;
    }
    const closings = Number.parseInt(String(editForm.closings), 10);
    if (!Number.isFinite(closings) || closings < 0) {
      setEditError("Closings must be a non-negative integer");
      return;
    }
    const brokerTrim = editForm.broker_id.trim();
    if (
      brokerTrim &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(brokerTrim)
    ) {
      setEditError("Broker ID must be a valid UUID or empty");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(`/api/admin/agents/${editAgent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim() ? editForm.phone.trim() : null,
          license_number: editForm.license_number.trim(),
          score,
          closings,
          status: editForm.status,
          broker_id: brokerTrim || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        setEditError(json.error?.message ?? `Save failed (${res.status})`);
        return;
      }
      setEditAgent(null);
      void fetchAllAgents();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  const approveBroker = async (id: string) => {
    setRejectOpen(null);
    await fetch(`/api/admin/verification/brokers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision: "approve" }),
    });
    void fetchVerification();
  };

  const approveAgent = async (id: string) => {
    setRejectOpen(null);
    await fetch(`/api/admin/verification/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision: "approve" }),
    });
    void fetchVerification();
  };

  const submitRejectBroker = async () => {
    if (!rejectOpen || rejectOpen.kind !== "broker") return;
    const reason = rejectReason.trim();
    if (!reason) return;
    await fetch(`/api/admin/verification/brokers/${rejectOpen.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision: "reject", reason }),
    });
    setRejectOpen(null);
    setRejectReason("");
    void fetchVerification();
  };

  const submitRejectAgent = async () => {
    if (!rejectOpen || rejectOpen.kind !== "agent") return;
    const reason = rejectReason.trim();
    if (!reason) return;
    await fetch(`/api/admin/verification/agents/${rejectOpen.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decision: "reject", reason }),
    });
    setRejectOpen(null);
    setRejectReason("");
    void fetchVerification();
  };

  const openDocReviewModal = async (agent: AllAgentRow) => {
    setDocReviewAgent(agent);
    setDocReviewUrls(null);
    setDocRejectReasonKey("");
    setDocRejectOtherText("");
    setDocSuspendReasonKey("");
    setDocSuspendOtherText("");
    setDocReviewLoading(true);
    try {
      const res = await fetch(`/api/admin/agents/${agent.id}/verification-review`, {
        credentials: "include",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: {
          license_number: string;
          prc_signed_url: string | null;
          selfie_signed_url: string | null;
          has_documents: boolean;
        };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data) {
        toast.error(json.error?.message ?? "Could not load documents");
        setDocReviewAgent(null);
        return;
      }
      setDocReviewUrls(json.data);
    } catch {
      toast.error("Could not load documents");
      setDocReviewAgent(null);
    } finally {
      setDocReviewLoading(false);
    }
  };

  const closeDocReviewModal = () => {
    setDocReviewAgent(null);
    setDocReviewUrls(null);
    setDocRejectReasonKey("");
    setDocRejectOtherText("");
    setDocSuspendReasonKey("");
    setDocSuspendOtherText("");
    setDocActionSaving(false);
  };

  const submitDocReviewDecision = async (decision: "approve" | "reject" | "suspend") => {
    if (!docReviewAgent) return;
    let payload: { decision: "approve" } | { decision: "reject"; reason: string } | { decision: "suspend"; reason: string };
    if (decision === "approve") {
      payload = { decision: "approve" };
    } else if (decision === "reject") {
      if (!docRejectReasonKey) {
        toast.error("Select a rejection reason.");
        return;
      }
      if (docRejectReasonKey === "Other" && !docRejectOtherText.trim()) {
        toast.error("Enter a custom rejection reason.");
        return;
      }
      const reason =
        docRejectReasonKey === "Other" ? docRejectOtherText.trim() : docRejectReasonKey;
      payload = { decision: "reject", reason };
    } else {
      if (!docSuspendReasonKey) {
        toast.error("Select a suspension reason.");
        return;
      }
      if (docSuspendReasonKey === "Other" && !docSuspendOtherText.trim()) {
        toast.error("Enter a custom suspension reason.");
        return;
      }
      const reason =
        docSuspendReasonKey === "Other" ? docSuspendOtherText.trim() : docSuspendReasonKey;
      payload = { decision: "suspend", reason };
    }
    setDocActionSaving(true);
    try {
      const res = await fetch(`/api/admin/agents/${docReviewAgent.id}/verification-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Update failed");
        return;
      }
      toast.success(
        decision === "approve"
          ? "Identity verification updated."
          : decision === "reject"
            ? "Verification rejected."
            : "Account suspended.",
      );
      closeDocReviewModal();
      void fetchAllAgents();
      void fetchVerification();
    } catch {
      toast.error("Update failed");
    } finally {
      setDocActionSaving(false);
    }
  };

  const leadStage = (l: Lead) => l.stage ?? l.status ?? "new";

  const signOutAdmin = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/signout";
  };

  const updateLeadStage = async (id: string | number, stage: string) => {
    await fetch(`/api/v1/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ stage }),
    });
    fetchLeads();
  };

  useEffect(() => {
    // Note: avoid calling setState synchronously in effect body (lint rule).
    // Queue the initial loads as microtasks once admin session is present.
    if (user?.id && profile?.role === "admin") {
      queueMicrotask(() => {
        fetchLeads();
        fetchProperties();
        void fetchVerification();
        void fetchAllAgents();
        void fetchCoAgentRequests();
      });
    }
  }, [user?.id, profile?.role]);

  useEffect(() => {
    if (user?.id && profile?.role === "admin" && adminSection === "users") {
      void fetchUsers();
    }
  }, [user?.id, profile?.role, adminSection]);

  useEffect(() => {
    if (user?.id && profile?.role === "admin" && adminSection === "coagent") {
      void fetchCoAgentRequests();
    }
  }, [user?.id, profile?.role, adminSection]);

  useEffect(() => {
    if (user?.id && profile?.role === "admin" && adminSection === "agents") {
      void fetchAllAgents();
    }
  }, [user?.id, profile?.role, adminSection]);

  const filteredLeads =
    filter === "all"
      ? leads
      : filter === "closed"
        ? leads.filter((l) => {
            const s = leadStage(l);
            return (
              s === "closed_won" ||
              s === "closed_lost" ||
              s === "closed"
            );
          })
        : leads.filter((l) => leadStage(l) === filter);

  const openNewProperty = () => {
    setEditingId(null);
    setPropertyForm(emptyPropertyForm);
    setPropertyError("");
  };

  const loadManageAgentsData = async (propertyId: string) => {
    setManageAgentsLoading(true);
    setManageAgentsError("");
    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/agents`, { credentials: "include" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { connected: PropertyConnectedAgent[]; availableToAdd: PropertyAgentOption[] };
        error?: { message?: string };
      };
      if (!res.ok || !json.success || !json.data) {
        setManageAgentsError(json.error?.message ?? "Failed to load property agents");
        setManageAgentsConnected([]);
        setManageAgentsAvailable([]);
        return;
      }
      setManageAgentsConnected(json.data.connected);
      setManageAgentsAvailable(json.data.availableToAdd);
    } catch {
      setManageAgentsError("Failed to load property agents");
      setManageAgentsConnected([]);
      setManageAgentsAvailable([]);
    } finally {
      setManageAgentsLoading(false);
    }
  };

  const openManageAgents = (p: Property) => {
    setManageAgentsProperty(p);
    setSelectedAgentToAdd("");
    void loadManageAgentsData(p.id);
  };

  const closeManageAgents = () => {
    setManageAgentsProperty(null);
    setManageAgentsError("");
    setSelectedAgentToAdd("");
  };

  const addPropertyAgent = async () => {
    if (!manageAgentsProperty || !selectedAgentToAdd) return;
    setManageAgentsMutating(true);
    try {
      const res = await fetch(`/api/admin/properties/${manageAgentsProperty.id}/agents`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: selectedAgentToAdd }),
      });
      const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Could not add agent");
        return;
      }
      toast.success("Agent added to property");
      setSelectedAgentToAdd("");
      await loadManageAgentsData(manageAgentsProperty.id);
    } finally {
      setManageAgentsMutating(false);
    }
  };

  const removePropertyAgent = async (agentId: string) => {
    if (!manageAgentsProperty) return;
    setManageAgentsMutating(true);
    try {
      const res = await fetch(
        `/api/admin/properties/${manageAgentsProperty.id}/agents?agent_id=${encodeURIComponent(agentId)}`,
        { method: "DELETE", credentials: "include" },
      );
      const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Could not remove agent");
        return;
      }
      toast.success("Agent removed from property");
      await loadManageAgentsData(manageAgentsProperty.id);
    } finally {
      setManageAgentsMutating(false);
    }
  };

  const submitResetPassword = async () => {
    if (!resetPasswordAgent) return;
    if (resetPasswordValue.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setResetPasswordSaving(true);
    try {
      const res = await fetch(`/api/admin/agents/${resetPasswordAgent.id}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordValue }),
      });
      const json = (await res.json()) as { success?: boolean; error?: { message?: string } };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Could not reset password");
        return;
      }
      toast.success("Password updated");
      setResetPasswordAgent(null);
      setResetPasswordValue("");
    } finally {
      setResetPasswordSaving(false);
    }
  };

  const openEditProperty = (p: Property) => {
    setEditingId(p.id);
    setPropertyForm({
      location: p.location,
      price: p.price,
      sqft: p.sqft,
      beds: String(p.beds),
      baths: String(p.baths),
      image_url: p.image_url,
    });
    setPropertyError("");
  };

  const saveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setPropertySaving(true);
    setPropertyError("");

    const beds = Number(propertyForm.beds);
    const baths = Number(propertyForm.baths);
    if (
      !propertyForm.location.trim() ||
      !propertyForm.price.trim() ||
      !propertyForm.sqft.trim() ||
      !propertyForm.image_url.trim() ||
      Number.isNaN(beds) ||
      Number.isNaN(baths)
    ) {
      setPropertyError("Fill all fields with valid numbers for beds and baths.");
      setPropertySaving(false);
      return;
    }

    const payload = {
      location: propertyForm.location.trim(),
      price: propertyForm.price.trim(),
      sqft: propertyForm.sqft.trim(),
      beds,
      baths,
      image_url: propertyForm.image_url.trim(),
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/admin/properties/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          setPropertyError(json.error || "Update failed");
          setPropertySaving(false);
          return;
        }
      } else {
        const res = await fetch("/api/admin/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          setPropertyError(json.error || "Create failed");
          setPropertySaving(false);
          return;
        }
      }
      setEditingId(null);
      setPropertyForm(emptyPropertyForm);
      await fetchProperties();
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : "Request failed");
    }
    setPropertySaving(false);
  };

  const deleteProperty = async (id: string) => {
    if (!confirm("Delete this listing permanently?")) return;
    setPropertyError("");
    try {
      const res = await fetch(`/api/admin/properties/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        setPropertyError(json.error || "Delete failed");
        return;
      }
      if (editingId === id) {
        setEditingId(null);
        setPropertyForm(emptyPropertyForm);
      }
      await fetchProperties();
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] text-sm text-[#2C2C2C]/50">
        Loading…
      </div>
    );
  }

  if (!user || profile?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] p-6">
        <div className="max-w-sm rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-[#2C2C2C]">Admin access</h1>
          <p className="mb-6 text-sm text-[#2C2C2C]/55">
            Sign in with an account that has the admin role.
          </p>
          <Link
            href="/auth/login?next=/admin"
            className="inline-flex rounded-full bg-[#2C2C2C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E]"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">Admin Dashboard</h1>
            <p className="text-sm text-[#2C2C2C]/55">BahayGo — Lead &amp; property management</p>
            <p className="mt-1 text-xs text-[#2C2C2C]/40">{user?.email}</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              onClick={() => void signOutAdmin()}
              className="self-end text-sm font-semibold text-[#2C2C2C]/55 underline hover:text-[#2C2C2C]"
            >
              Sign out
            </button>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdminSection("leads")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  adminSection === "leads"
                    ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                    : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
                }`}
              >
                Leads
              </button>
              <button
                type="button"
                onClick={() => setAdminSection("properties")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  adminSection === "properties"
                    ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                    : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
                }`}
              >
                Properties
                <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs">
                  {properties.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAdminSection("verification")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  adminSection === "verification"
                    ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                    : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
                }`}
              >
                Verification
                <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs">
                  {pendingBrokers.length + pendingAgents.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAdminSection("agents")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  adminSection === "agents"
                    ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                    : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
                }`}
              >
                Agents
                <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs">
                  {allAgentsList.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAdminSection("users")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  adminSection === "users"
                    ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                    : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
                }`}
              >
                Users
                <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs">
                  {adminUsers.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAdminSection("coagent")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  adminSection === "coagent"
                    ? "bg-[#6B9E6E] text-white shadow-sm ring-1 ring-[#D4A843]/35"
                    : "border border-[#2C2C2C]/10 bg-white text-[#2C2C2C]/70 hover:border-[#6B9E6E]/40"
                }`}
              >
                Co-Agent Requests
                <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs">
                  {coAgentRequests.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {adminSection === "users" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#2C2C2C]/70">
                All registered profiles (merged with auth email).
              </p>
              <button
                type="button"
                onClick={() => void fetchUsers()}
                className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm hover:bg-[#FAF8F4]"
              >
                Refresh
              </button>
            </div>
            {usersError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {usersError}
              </div>
            )}
            <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
              {usersLoading ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">Loading users…</div>
              ) : adminUsers.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#2C2C2C]/45">No users found.</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3">Verified</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C2C2C]/5">
                    {adminUsers.map((u) => {
                      const verifiedLabel =
                        u.role === "agent"
                          ? u.agent_verified === null
                            ? "—"
                            : u.agent_verified
                              ? "Yes"
                              : "No"
                          : u.role === "broker"
                            ? u.broker_verified === null
                              ? "—"
                              : u.broker_verified
                                ? "Yes"
                                : "No"
                            : "—";
                      return (
                        <tr key={u.id} className="hover:bg-[#FAF8F4]/80">
                          <td className="px-4 py-3 text-sm font-semibold text-[#2C2C2C]">
                            {u.full_name?.trim() || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#2C2C2C]/75">{u.email ?? "—"}</td>
                          <td className="px-4 py-3">
                            <select
                              value={u.role}
                              onChange={(e) => void updateUserRole(u.id, e.target.value)}
                              className="max-w-[140px] rounded-lg border border-[#2C2C2C]/10 bg-white px-2 py-1.5 text-xs font-semibold text-[#2C2C2C]"
                            >
                              <option value="client">client</option>
                              <option value="agent">agent</option>
                              <option value="broker">broker</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#2C2C2C]/50">
                            {new Date(u.created_at).toLocaleDateString("en-PH")}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-[#6B9E6E]">
                            {verifiedLabel}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {u.agent_id && u.agent_status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => void approveAgent(u.agent_id!)}
                                  className="rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#6b8a6d]"
                                >
                                  Approve agent
                                </button>
                              )}
                              {u.broker_id && u.broker_status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => void approveBroker(u.broker_id!)}
                                  className="rounded-full bg-[#6B9E6E] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#6b8a6d]"
                                >
                                  Approve broker
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void deleteUser(u.id)}
                                className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {adminSection === "leads" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-gray-500">
                {leads.length} total leads
              </span>
              <button
                onClick={fetchLeads}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-all"
              >
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Leads", value: leads.length, color: "bg-white" },
                {
                  label: "New",
                  value: leads.filter((l) => leadStage(l) === "new").length,
                  color: "bg-blue-50",
                },
                {
                  label: "Contacted",
                  value: leads.filter((l) => leadStage(l) === "contacted")
                    .length,
                  color: "bg-yellow-50",
                },
                {
                  label: "Closed",
                  value: leads.filter((l) => {
                    const s = leadStage(l);
                    return (
                      s === "closed_won" ||
                      s === "closed_lost" ||
                      s === "closed"
                    );
                  }).length,
                  color: "bg-green-50",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`${stat.color} rounded-2xl border border-gray-200 p-4`}
                >
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              {(["all", "new", "contacted", "closed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-all ${
                    filter === f
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-500 border border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  Loading leads...
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  No leads yet.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-gray-100">
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">Property Interest</th>
                      <th className="px-6 py-4">Message</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50 transition-all">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {lead.name}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-gray-700">{lead.email}</p>
                          <p className="text-xs text-gray-400">{lead.phone}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {lead.property_interest}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {lead.message}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">
                          {new Date(lead.created_at).toLocaleDateString("en-PH", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={leadStage(lead)}
                            onChange={(e) =>
                              updateLeadStage(lead.id, e.target.value)
                            }
                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none max-w-[140px]"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="qualified">Qualified</option>
                            <option value="viewing">Viewing</option>
                            <option value="negotiation">Negotiation</option>
                            <option value="closed_won">Closed (won)</option>
                            <option value="closed_lost">Closed (lost)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {adminSection === "properties" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                {propertiesLoading
                  ? "Loading properties..."
                  : `${properties.length} listing${properties.length === 1 ? "" : "s"} in Supabase`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchProperties}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={openNewProperty}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                >
                  Add property
                </button>
              </div>
            </div>

            {propertyError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {propertyError}
              </div>
            )}

            <p className="text-xs text-gray-400">
              Creating, editing, or deleting listings requires{" "}
              <code className="rounded bg-gray-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              in <code className="rounded bg-gray-100 px-1">.env.local</code> (server-only).
            </p>

            <form
              onSubmit={saveProperty}
              className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4"
            >
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "Edit property" : "New property"}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-medium text-gray-500">
                  Location
                  <input
                    required
                    value={propertyForm.location}
                    onChange={(e) =>
                      setPropertyForm((f) => ({ ...f, location: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  Price (display)
                  <input
                    required
                    value={propertyForm.price}
                    onChange={(e) =>
                      setPropertyForm((f) => ({ ...f, price: e.target.value }))
                    }
                    placeholder="₱125,000,000"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  Sqft (display)
                  <input
                    required
                    value={propertyForm.sqft}
                    onChange={(e) =>
                      setPropertyForm((f) => ({ ...f, sqft: e.target.value }))
                    }
                    placeholder="4,200"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  Image URL
                  <input
                    required
                    value={propertyForm.image_url}
                    onChange={(e) =>
                      setPropertyForm((f) => ({ ...f, image_url: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  Beds
                  <input
                    required
                    type="number"
                    min={0}
                    value={propertyForm.beds}
                    onChange={(e) =>
                      setPropertyForm((f) => ({ ...f, beds: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-500">
                  Baths
                  <input
                    required
                    type="number"
                    min={0}
                    value={propertyForm.baths}
                    onChange={(e) =>
                      setPropertyForm((f) => ({ ...f, baths: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={propertySaving}
                  className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  {propertySaving
                    ? "Saving..."
                    : editingId
                      ? "Update property"
                      : "Create property"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={openNewProperty}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>

            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              {propertiesLoading ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  Loading properties...
                </div>
              ) : properties.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">
                  No properties yet. Add one above or run the SQL seed migration.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-gray-100 bg-gray-50/80">
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Sqft</th>
                      <th className="px-4 py-3">Beds</th>
                      <th className="px-4 py-3">Baths</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {properties.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/80">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[220px]">
                          {p.location}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {p.price}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {p.sqft}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {p.beds}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {p.baths}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openManageAgents(p)}
                              className="text-sm font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                            >
                              Manage Agents
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditProperty(p)}
                              className="text-sm font-medium text-gray-900 underline underline-offset-2 hover:text-gray-600"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteProperty(p.id)}
                              className="text-sm font-medium text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {adminSection === "verification" && (
          <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                Approve or reject broker and agent applications. Decisions notify the applicant.
              </p>
              <button
                type="button"
                onClick={() => void fetchVerification()}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>
            {verificationError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <p className="font-medium text-red-900 mb-2">
                  Verification queue could not be loaded
                </p>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-red-900/90 max-h-80 overflow-auto">
                  {verificationError}
                </pre>
              </div>
            )}
            {!verificationLoading &&
              !verificationError &&
              pendingBrokers.length === 0 &&
              pendingAgents.length === 0 &&
              documentQueueAgents.length === 0 &&
              !allAgentsLoading && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  No pending applications.
                </div>
              )}

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Pending brokers
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({pendingBrokers.length})
                </span>
              </h2>
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                {verificationLoading ? (
                  <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
                ) : pendingBrokers.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">No pending brokers.</div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b border-gray-100 bg-gray-50/80">
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">License</th>
                        <th className="px-4 py-3">Submitted</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pendingBrokers.map((b) => (
                        <Fragment key={b.id}>
                          <tr className="hover:bg-gray-50/80 align-top">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {b.company_name}
                              <p className="text-xs font-normal text-gray-500">{b.name}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {b.email}
                              {b.phone && (
                                <p className="text-xs text-gray-500">{b.phone}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {b.license_number}
                              {b.license_expiry && (
                                <p className="text-gray-500">exp {b.license_expiry}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(b.created_at).toLocaleDateString("en-PH")}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => void approveBroker(b.id)}
                                  className="rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#6b8a6d]"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectOpen({ kind: "broker", id: b.id });
                                    setRejectReason("");
                                  }}
                                  className="rounded-full border-2 border-red-300 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-800 hover:bg-red-100"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                          {rejectOpen?.kind === "broker" && rejectOpen.id === b.id && (
                            <tr className="bg-amber-50/50">
                              <td colSpan={5} className="px-4 py-3">
                                <p className="text-xs font-medium text-gray-700 mb-2">
                                  Rejection reason (sent to applicant)
                                </p>
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  rows={3}
                                  className="w-full max-w-xl rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none mb-2"
                                  placeholder="Explain why this application was not approved."
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void submitRejectBroker()}
                                    disabled={!rejectReason.trim()}
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    Send rejection
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRejectOpen(null)}
                                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Pending agents
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({pendingAgents.length})
                </span>
              </h2>
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                {verificationLoading ? (
                  <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
                ) : pendingAgents.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">No pending agents.</div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b border-gray-100 bg-gray-50/80">
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">License</th>
                        <th className="px-4 py-3">Broker id</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pendingAgents.map((a) => (
                        <Fragment key={a.id}>
                          <tr className="hover:bg-gray-50/80 align-top">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {a.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {a.email}
                              {a.phone && (
                                <p className="text-xs text-gray-500">{a.phone}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {a.license_number}
                              {a.license_expiry && (
                                <p className="text-gray-500">exp {a.license_expiry}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                              {a.broker_id ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => void approveAgent(a.id)}
                                  className="rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#6b8a6d]"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectOpen({ kind: "agent", id: a.id });
                                    setRejectReason("");
                                  }}
                                  className="rounded-full border-2 border-red-300 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-800 hover:bg-red-100"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                          {rejectOpen?.kind === "agent" && rejectOpen.id === a.id && (
                            <tr className="bg-amber-50/50">
                              <td colSpan={5} className="px-4 py-3">
                                <p className="text-xs font-medium text-gray-700 mb-2">
                                  Rejection reason (sent to applicant)
                                </p>
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  rows={3}
                                  className="w-full max-w-xl rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none mb-2"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void submitRejectAgent()}
                                    disabled={!rejectReason.trim()}
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    Send rejection
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRejectOpen(null)}
                                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Document Verification Queue
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({documentQueueAgents.length})
                </span>
              </h2>
              <p className="mb-3 text-sm text-gray-500">
                Approved agents waiting on PRC / identity document review (verification_status pending or rejected).
              </p>
              <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                {allAgentsLoading ? (
                  <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
                ) : documentQueueAgents.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">No agents in the document queue.</div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b border-gray-100 bg-gray-50/80">
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">PRC (masked)</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {documentQueueAgents.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50/80 align-top">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {a.email}
                            {a.phone ? <p className="text-xs text-gray-500">{a.phone}</p> : null}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-gray-600">
                            {maskPrcForAdminQueue(a.license_number)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={docQueueBadgeClass(a.verification_status)}>
                              {a.verification_status === "pending"
                                ? "pending"
                                : a.verification_status === "rejected"
                                  ? "rejected"
                                  : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => void openDocReviewModal(a)}
                              className="rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-gray-800"
                            >
                              Review Documents
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        )}

        {adminSection === "agents" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#2C2C2C]/70">
                Every agent record — edit, approve, reject, or delete.
              </p>
              <button
                type="button"
                onClick={() => void fetchAllAgents()}
                className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm hover:bg-[#FAF8F4]"
              >
                Refresh
              </button>
            </div>
            <section className="rounded-2xl border border-[#D4A843]/25 bg-[#FAF8F4] p-6 shadow-sm">
              <h2 className="mb-4 font-serif text-xl font-bold text-[#2C2C2C]">
                All agents
                <span className="ml-2 text-sm font-normal text-[#2C2C2C]/50">
                  ({allAgentsList.length} total)
                </span>
              </h2>
              <p className="mb-4 text-sm text-[#2C2C2C]/60">
                Includes pending and rejected applications.
              </p>
              <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white">
                {allAgentsLoading ? (
                  <div className="p-8 text-center text-sm text-[#2C2C2C]/45">Loading…</div>
                ) : allAgentsList.length === 0 ? (
                  <div className="p-8 text-center text-sm text-[#2C2C2C]/45">No agent records.</div>
                ) : (
                  <table className="w-full">
                    <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                      <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">License</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Verification</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2C2C2C]/5">
                      {allAgentsList.map((a) => (
                        <Fragment key={a.id}>
                          <tr className="hover:bg-[#FAF8F4]/50">
                            <td className="px-4 py-3 text-sm font-semibold text-[#2C2C2C]">{a.name}</td>
                            <td className="px-4 py-3 text-sm text-[#2C2C2C]/75">{a.email}</td>
                            <td className="px-4 py-3 text-xs text-[#2C2C2C]/60">{a.license_number}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-[#EBE6DC] px-2 py-0.5 text-xs font-bold capitalize text-[#2C2C2C]/80">
                                {a.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-sm font-semibold ${verificationColumnClass(a.verification_status)}`}
                              >
                                {verificationColumnLabel(a.verification_status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {a.status === "pending" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void approveAgent(a.id)}
                                      className="rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#6b8a6d]"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectOpen({ kind: "agent", id: a.id });
                                        setRejectReason("");
                                      }}
                                      className="rounded-full border-2 border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-800"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResetPasswordAgent(a);
                                    setResetPasswordValue("");
                                  }}
                                  className="rounded-full border border-[#6B9E6E]/35 bg-[#6B9E6E]/10 px-4 py-2 text-xs font-bold text-[#2C2C2C] hover:bg-[#6B9E6E]/20"
                                >
                                  Reset Password
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditAgent(a)}
                                  className="rounded-full border border-[#D4A843]/40 bg-[#FAF8F4] px-4 py-2 text-xs font-bold text-[#2C2C2C] hover:bg-[#D4A843]/20"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteAgentRow(a.id)}
                                  className="rounded-full border border-[#2C2C2C]/15 bg-white px-4 py-2 text-xs font-bold text-[#2C2C2C]/70 hover:bg-red-50 hover:text-red-800"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                          {rejectOpen?.kind === "agent" && rejectOpen.id === a.id && (
                            <tr className="bg-amber-50/60">
                              <td colSpan={6} className="px-4 py-3">
                                <p className="mb-2 text-xs font-semibold text-[#2C2C2C]">
                                  Rejection reason (sent to applicant)
                                </p>
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  rows={3}
                                  className="mb-2 w-full max-w-xl rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm outline-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void submitRejectAgent()}
                                    disabled={!rejectReason.trim()}
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    Send rejection
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRejectOpen(null)}
                                    className="rounded-lg border border-[#2C2C2C]/10 px-3 py-1.5 text-xs font-semibold text-[#2C2C2C]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        )}

        {adminSection === "coagent" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#2C2C2C]/70">
                Agents who asked to be linked to an existing listing. Approve adds them to{" "}
                <code className="rounded bg-[#EBE6DC] px-1 text-xs">property_agents</code> and notifies by SMS.
              </p>
              <button
                type="button"
                onClick={() => void fetchCoAgentRequests()}
                className="rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-sm hover:bg-[#FAF8F4]"
              >
                Refresh
              </button>
            </div>
            {coAgentError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {coAgentError}
              </div>
            ) : null}
            <div className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
              {coAgentLoading ? (
                <div className="p-8 text-center text-sm text-[#2C2C2C]/45">Loading…</div>
              ) : coAgentRequests.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#2C2C2C]/45">No pending co-agent requests.</div>
              ) : (
                <table className="w-full">
                  <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
                    <tr className="text-left text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/50">
                      <th className="px-4 py-3">Property</th>
                      <th className="px-4 py-3">Agent</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C2C2C]/5">
                    {coAgentRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-[#FAF8F4]/40">
                        <td className="px-4 py-3 text-sm font-semibold text-[#2C2C2C]">
                          <span className="block">{r.propertyName}</span>
                          {r.propertyLocation ? (
                            <span className="mt-0.5 block text-xs font-medium text-[#2C2C2C]/55">
                              {r.propertyLocation}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#2C2C2C]/80">{r.agentName}</td>
                        <td className="px-4 py-3 text-xs text-[#2C2C2C]/55">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void decideCoAgentRequest(r.id, "approve")}
                              className="rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#5d8a60]"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => void decideCoAgentRequest(r.id, "reject")}
                              className="rounded-full border-2 border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-800 hover:bg-red-100"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {manageAgentsProperty ? (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={closeManageAgents}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-manage-agents-title"
            className="relative z-[106] max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="admin-manage-agents-title" className="font-serif text-xl font-bold text-[#2C2C2C]">
                Manage agents
              </h2>
              <button
                type="button"
                onClick={closeManageAgents}
                className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-[#2C2C2C]/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{manageAgentsProperty.location}</p>

            {manageAgentsError ? (
              <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-800">
                {manageAgentsError}
              </p>
            ) : null}

            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Connected agents</p>
              {manageAgentsLoading ? (
                <p className="mt-2 text-sm text-[#2C2C2C]/55">Loading…</p>
              ) : manageAgentsConnected.length === 0 ? (
                <p className="mt-2 text-sm text-[#2C2C2C]/55">None linked yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[#2C2C2C]/10 rounded-xl border border-[#2C2C2C]/10">
                  {manageAgentsConnected.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-semibold text-[#2C2C2C]">{a.name}</span>
                        <span className="ml-2 text-xs text-[#2C2C2C]/55">{a.email}</span>
                      </div>
                      <button
                        type="button"
                        disabled={manageAgentsMutating}
                        onClick={() => void removePropertyAgent(a.id)}
                        className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 border-t border-[#2C2C2C]/10 pt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Add approved agent</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={selectedAgentToAdd}
                  onChange={(e) => setSelectedAgentToAdd(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                >
                  <option value="">Select an agent…</option>
                  {manageAgentsAvailable.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name} ({opt.email})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={manageAgentsMutating || !selectedAgentToAdd || manageAgentsLoading}
                  onClick={() => void addPropertyAgent()}
                  className="rounded-full bg-[#6B9E6E] px-4 py-2 text-sm font-bold text-white hover:bg-[#5d8a60] disabled:opacity-50"
                >
                  Add Agent
                </button>
              </div>
              <p className="mt-2 text-xs text-[#2C2C2C]/50">
                Only agents with status <strong>approved</strong> and <strong>verified</strong> appear here.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {docReviewAgent ? (
        <div className="fixed inset-0 z-[109] flex items-center justify-center overflow-y-auto p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => closeDocReviewModal()}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-doc-review-title"
            className="relative z-[110] my-8 w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="admin-doc-review-title" className="font-serif text-xl font-bold text-[#2C2C2C]">
                Review documents
              </h2>
              <button
                type="button"
                onClick={() => closeDocReviewModal()}
                className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-[#2C2C2C]/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">
              <strong>{docReviewAgent.name}</strong> · {docReviewAgent.email}
            </p>

            {docReviewLoading ? (
              <p className="mt-6 text-sm text-gray-500">Loading documents…</p>
            ) : docReviewUrls ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                    Full PRC number (admin)
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[#2C2C2C]">
                    {docReviewUrls.license_number || "—"}
                  </p>
                </div>

                {!docReviewUrls.has_documents ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    No documents uploaded yet
                  </p>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                        PRC license photo
                      </p>
                      {docReviewUrls.prc_signed_url ? (
                        docReviewUrls.prc_signed_url.toLowerCase().includes(".pdf") ? (
                          <a
                            href={docReviewUrls.prc_signed_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex rounded-lg border border-[#6B9E6E]/30 bg-[#6B9E6E]/10 px-4 py-2 text-sm font-semibold text-[#2C2C2C] underline"
                          >
                            Open PDF
                          </a>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={docReviewUrls.prc_signed_url}
                            alt="PRC license"
                            className="mt-2 max-h-64 w-full rounded-lg border border-gray-200 object-contain"
                          />
                        )
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">Could not load file.</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                        Selfie / live photo
                      </p>
                      {docReviewUrls.selfie_signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={docReviewUrls.selfie_signed_url}
                          alt="Selfie"
                          className="mt-2 max-h-64 w-full rounded-lg border border-gray-200 object-contain"
                        />
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">Could not load file.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                      Rejection reason
                    </label>
                    <select
                      value={docRejectReasonKey}
                      onChange={(e) => setDocRejectReasonKey(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 bg-white px-3 py-2 text-sm text-[#2C2C2C]"
                    >
                      <option value="">Select rejection reason…</option>
                      {DOC_REJECT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {docRejectReasonKey === "Other" ? (
                      <input
                        type="text"
                        value={docRejectOtherText}
                        onChange={(e) => setDocRejectOtherText(e.target.value)}
                        placeholder="Custom reason"
                        className="mt-2 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm text-[#2C2C2C]"
                      />
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                      Suspension reason
                    </label>
                    <select
                      value={docSuspendReasonKey}
                      onChange={(e) => setDocSuspendReasonKey(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 bg-white px-3 py-2 text-sm text-[#2C2C2C]"
                    >
                      <option value="">Select suspension reason…</option>
                      {DOC_SUSPEND_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {docSuspendReasonKey === "Other" ? (
                      <input
                        type="text"
                        value={docSuspendOtherText}
                        onChange={(e) => setDocSuspendOtherText(e.target.value)}
                        placeholder="Custom reason"
                        className="mt-2 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm text-[#2C2C2C]"
                      />
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={docActionSaving}
                    onClick={() => void submitDocReviewDecision("approve")}
                    className="rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#5d8a60] disabled:opacity-50"
                  >
                    {docActionSaving ? "Saving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    disabled={docActionSaving}
                    onClick={() => void submitDocReviewDecision("reject")}
                    className="rounded-full border-2 border-red-300 bg-red-50 px-5 py-2.5 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    {docActionSaving ? "Saving…" : "Reject"}
                  </button>
                  <button
                    type="button"
                    disabled={docActionSaving}
                    onClick={() => void submitDocReviewDecision("suspend")}
                    className="rounded-full border-2 border-red-600 bg-white px-5 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {docActionSaving ? "Saving…" : "Suspend"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-red-600">Could not load document data.</p>
            )}
          </div>
        </div>
      ) : null}

      {resetPasswordAgent ? (
        <div className="fixed inset-0 z-[107] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => {
              setResetPasswordAgent(null);
              setResetPasswordValue("");
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-reset-password-title"
            className="relative z-[108] w-full max-w-sm rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="admin-reset-password-title" className="font-serif text-lg font-bold text-[#2C2C2C]">
              Reset password
            </h2>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">
              New password for <strong>{resetPasswordAgent.name}</strong> ({resetPasswordAgent.email})
            </p>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                placeholder="Min. 8 characters"
              />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetPasswordAgent(null);
                  setResetPasswordValue("");
                }}
                className="rounded-full border border-[#2C2C2C]/15 px-4 py-2 text-sm font-semibold text-[#2C2C2C]/70"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetPasswordSaving || resetPasswordValue.length < 8}
                onClick={() => void submitResetPassword()}
                className="rounded-full bg-[#2C2C2C] px-5 py-2 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:opacity-50"
              >
                {resetPasswordSaving ? "Saving…" : "Update password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editAgent ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => setEditAgent(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-edit-agent-title"
            className="relative z-[101] max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="admin-edit-agent-title" className="font-serif text-xl font-bold text-[#2C2C2C]">
                Edit agent
              </h2>
              <button
                type="button"
                onClick={() => setEditAgent(null)}
                className="rounded-full p-2 text-[#2C2C2C]/55 hover:bg-[#2C2C2C]/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-[#2C2C2C]/50">
              Updates <code className="rounded bg-[#FAF8F4] px-1">agents</code> and matching{" "}
              <code className="rounded bg-[#FAF8F4] px-1">profiles</code> (name, email, phone).
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Name
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Email
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Phone
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                License number
                <input
                  value={editForm.license_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, license_number: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Score
                  <input
                    type="number"
                    step="any"
                    value={editForm.score}
                    onChange={(e) => setEditForm((f) => ({ ...f, score: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Closings
                  <input
                    type="number"
                    min={0}
                    value={editForm.closings}
                    onChange={(e) => setEditForm((f) => ({ ...f, closings: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                  />
                </label>
              </div>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Status
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 text-sm font-semibold text-[#2C2C2C]"
                >
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </label>
              <p className="text-xs font-semibold text-[#2C2C2C]/55">
                Verified:{" "}
                <span className="text-[#6B9E6E]">
                  {editForm.status === "approved" ? "Yes" : "No"}
                </span>{" "}
                (synced from status in the database)
              </p>
              <label className="block text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Broker ID (UUID or empty)
                <input
                  value={editForm.broker_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, broker_id: e.target.value }))}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="mt-1 w-full rounded-lg border border-[#2C2C2C]/10 px-3 py-2 font-mono text-xs text-[#2C2C2C]"
                />
              </label>
            </div>

            {editError ? (
              <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-800">
                {editError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditAgent(null)}
                className="rounded-full border border-[#2C2C2C]/15 px-4 py-2 text-sm font-semibold text-[#2C2C2C]/70"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => void saveEditAgent()}
                className="rounded-full bg-[#2C2C2C] px-5 py-2 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  license_number: string;
  status: string;
  verified: boolean;
  user_id: string;
  created_at: string;
  rejection_reason: string | null;
}

const emptyPropertyForm = {
  location: "",
  price: "",
  sqft: "",
  beds: "",
  baths: "",
  image_url: "",
};

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
    "leads" | "properties" | "verification" | "users"
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

  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [allAgentsList, setAllAgentsList] = useState<AllAgentRow[]>([]);
  const [allAgentsLoading, setAllAgentsLoading] = useState(false);

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

  const leadStage = (l: Lead) => l.stage ?? l.status ?? "new";

  const signOutAdmin = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
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
      });
    }
  }, [user?.id, profile?.role]);

  useEffect(() => {
    if (user?.id && profile?.role === "admin" && adminSection === "users") {
      void fetchUsers();
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
                        <td className="px-4 py-3 text-right space-x-2">
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
              pendingAgents.length === 0 && (
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

            <section className="rounded-2xl border border-[#D4A843]/25 bg-[#FAF8F4] p-6 shadow-sm">
              <h2 className="mb-4 font-serif text-xl font-bold text-[#2C2C2C]">
                View all agents
                <span className="ml-2 text-sm font-normal text-[#2C2C2C]/50">
                  ({allAgentsList.length} total)
                </span>
              </h2>
              <p className="mb-4 text-sm text-[#2C2C2C]/60">
                Every agent record in the database, including pending and rejected.
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
                        <th className="px-4 py-3">Verified</th>
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
                            <td className="px-4 py-3 text-sm font-semibold text-[#6B9E6E]">
                              {a.verified ? "Yes" : "No"}
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
      </div>
    </div>
  );
}

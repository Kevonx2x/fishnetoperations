"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const ADMIN_PASSWORD = "fishnet2026";

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
}

const emptyPropertyForm = {
  location: "",
  price: "",
  sqft: "",
  beds: "",
  baths: "",
  image_url: "",
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [wrongPassword, setWrongPassword] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [adminSection, setAdminSection] = useState<"leads" | "properties">(
    "leads",
  );

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [propertyForm, setPropertyForm] = useState(emptyPropertyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [propertyError, setPropertyError] = useState("");
  const [propertySaving, setPropertySaving] = useState(false);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthed(true);
      setWrongPassword(false);
    } else {
      setWrongPassword(true);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/leads", {
        headers: { "x-admin-password": ADMIN_PASSWORD },
      });
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

  const leadStage = (l: Lead) => l.stage ?? l.status ?? "new";

  const updateLeadStage = async (id: string | number, stage: string) => {
    await fetch(`/api/v1/leads/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": ADMIN_PASSWORD,
      },
      body: JSON.stringify({ stage }),
    });
    fetchLeads();
  };

  useEffect(() => {
    if (authed) {
      fetchLeads();
      fetchProperties();
    }
  }, [authed]);

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
      password: ADMIN_PASSWORD,
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: ADMIN_PASSWORD }),
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

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Admin Login</h1>
          <p className="text-sm text-gray-500 mb-6">Fishnet Operations</p>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400 mb-3"
          />
          {wrongPassword && (
            <p className="text-red-500 text-xs mb-3">
              ❌ Wrong password. Try again.
            </p>
          )}
          <button
            onClick={handleLogin}
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-700 transition-all"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-500">
              Fishnet Operations — Lead &amp; property management
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAdminSection("leads")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                adminSection === "leads"
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
              }`}
            >
              Leads
            </button>
            <button
              type="button"
              onClick={() => setAdminSection("properties")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                adminSection === "properties"
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-400"
              }`}
            >
              Properties
              <span className="ml-1.5 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {properties.length}
              </span>
            </button>
          </div>
        </div>

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
      </div>
    </div>
  );
}

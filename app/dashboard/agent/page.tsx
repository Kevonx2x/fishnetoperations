"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LicenseExpiryBadge } from "@/components/LicenseExpiryBadge";
import { useAuth } from "@/contexts/auth-context";
import {
  formatLicenseDate,
  isLicenseExpiringWithinDays,
} from "@/lib/license-expiry";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AgentRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  license_number: string;
  license_expiry: string | null;
  image_url: string | null;
  status: string;
  verified: boolean;
  broker_id: string | null;
};

type LeadRow = {
  id: string | number;
  name: string;
  email: string;
  stage?: string;
  status?: string;
  created_at: string;
  property_interest: string | null;
};

type PropertyRow = {
  id: string;
  location: string;
  price: string;
  beds: number;
  baths: number;
};

export default function AgentDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [brokerage, setBrokerage] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    bio: "",
    license_number: "",
    license_expiry: "",
    image_url: "",
  });

  useEffect(() => {
    if (!user?.id || authLoading) return;
    void (async () => {
      const { data: a } = await supabase
        .from("agents")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      setAgent((a as AgentRow | null) ?? null);
      setLoaded(true);

      if (a?.broker_id) {
        const { data: br } = await supabase
          .from("brokers")
          .select("company_name")
          .eq("id", a.broker_id)
          .maybeSingle();
        setBrokerage((br as { company_name?: string } | null)?.company_name ?? null);
      } else {
        setBrokerage(null);
      }

      if (a && a.status === "approved" && a.verified) {
        const { data: ld } = await supabase
          .from("leads")
          .select("id, name, email, stage, status, created_at, property_interest")
          .eq("agent_id", user.id)
          .order("created_at", { ascending: false });
        setLeads((ld as LeadRow[]) ?? []);

        const { data: pr } = await supabase
          .from("properties")
          .select("id, location, price, beds, baths")
          .eq("listed_by", user.id);
        setProperties((pr as PropertyRow[]) ?? []);
      } else {
        setLeads([]);
        setProperties([]);
      }
    })();
  }, [user?.id, authLoading, supabase]);

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name,
        phone: agent.phone ?? "",
        email: agent.email,
        bio: agent.bio ?? "",
        license_number: agent.license_number,
        license_expiry: agent.license_expiry ?? "",
        image_url: agent.image_url ?? "",
      });
    }
  }, [agent]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !agent) return;
    setSaveMsg("");
    const { error } = await supabase
      .from("agents")
      .update({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim(),
        bio: form.bio.trim() || null,
        license_number: form.license_number.trim(),
        license_expiry: form.license_expiry.trim() || null,
        image_url: form.image_url.trim() || null,
      })
      .eq("user_id", user.id);
    if (error) {
      setSaveMsg(error.message);
      return;
    }
    const { data: a } = await supabase
      .from("agents")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setAgent((a as AgentRow | null) ?? null);
    setEditOpen(false);
    setSaveMsg("Saved.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (authLoading || !loaded) {
    return (
      <div className="min-h-screen bg-[#f7f6f3] flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-[#f7f6f3] px-4 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-black/8 bg-white p-8">
          <h1 className="font-serif text-xl text-gray-900">Agent dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            No agent profile is linked to this account yet.
          </p>
          <Link
            href="/register/agent"
            className="mt-6 inline-block rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white"
          >
            Register as an agent
          </Link>
        </div>
      </div>
    );
  }

  const approved = agent.status === "approved" && agent.verified;
  const pending = agent.status === "pending";
  const rejected = agent.status === "rejected";

  return (
    <div className="min-h-screen bg-[#f7f6f3]">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="font-serif text-xl text-gray-900">Agent dashboard</h1>
            <p className="text-xs text-gray-500">{agent.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
              Home
            </Link>
            <Link href="/profile" className="text-sm text-gray-600 hover:text-gray-900">
              Profile
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-sm text-gray-600 underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <section className="rounded-2xl border border-black/8 bg-white p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Verification</h2>
            {approved && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                Verified
              </span>
            )}
            {pending && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                Pending
              </span>
            )}
            {rejected && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-900">
                Rejected
              </span>
            )}
            <LicenseExpiryBadge licenseExpiry={agent.license_expiry} />
          </div>
          {brokerage && (
            <p className="mt-2 text-sm text-gray-600">Brokerage: {brokerage}</p>
          )}
          {pending && (
            <p className="mt-3 text-sm text-gray-600">
              Your application is under review. We will notify you when it has been decided.
            </p>
          )}
          {rejected && (
            <p className="mt-3 text-sm text-gray-600">
              Your last application was not approved. Update your profile below or contact support.
            </p>
          )}
          {agent.license_expiry && (
            <p className="mt-2 text-xs text-gray-500">
              License expires {formatLicenseDate(agent.license_expiry)}
              {isLicenseExpiringWithinDays(agent.license_expiry, 30) && (
                <span className="font-medium text-amber-800"> — renew soon</span>
              )}
            </p>
          )}

          <button
            type="button"
            onClick={() => setEditOpen((v) => !v)}
            className="mt-4 text-sm font-medium text-gray-900 underline"
          >
            {editOpen ? "Close editor" : "Edit profile"}
          </button>

          {editOpen && (
            <form onSubmit={saveProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-gray-500">
                Full name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-500">
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-500 sm:col-span-2">
                Email
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-500">
                License number
                <input
                  required
                  value={form.license_number}
                  onChange={(e) => setForm((f) => ({ ...f, license_number: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-500">
                License expiry
                <input
                  type="date"
                  value={form.license_expiry}
                  onChange={(e) => setForm((f) => ({ ...f, license_expiry: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-500 sm:col-span-2">
                Photo URL
                <input
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-500 sm:col-span-2">
                Bio
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              {saveMsg && <p className="sm:col-span-2 text-sm text-gray-600">{saveMsg}</p>}
              <button
                type="submit"
                className="sm:col-span-2 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white"
              >
                Save changes
              </button>
            </form>
          )}
        </section>

        {approved && (
          <>
            <section className="rounded-2xl border border-black/8 bg-white p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Assigned leads ({leads.length})
              </h2>
              {leads.length === 0 ? (
                <p className="text-sm text-gray-500">No leads assigned yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {leads.map((l) => (
                    <li key={String(l.id)} className="py-3">
                      <p className="text-sm font-medium text-gray-900">{l.name}</p>
                      <p className="text-xs text-gray-500">{l.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {l.stage ?? l.status ?? "new"}
                        {l.property_interest && ` · ${l.property_interest}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-black/8 bg-white p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                My listings ({properties.length})
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                Properties where your profile is{" "}
                <code className="rounded bg-gray-100 px-1">listed_by</code>.
              </p>
              {properties.length === 0 ? (
                <p className="text-sm text-gray-500">No listings assigned to you yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {properties.map((p) => (
                    <li key={p.id} className="py-3">
                      <p className="text-sm font-medium text-gray-900">{p.location}</p>
                      <p className="text-xs text-gray-500">
                        {p.price} · {p.beds} bd / {p.baths} ba
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

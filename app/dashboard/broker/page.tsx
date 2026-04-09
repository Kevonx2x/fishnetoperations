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
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";

type BrokerRow = {
  id: string;
  name: string;
  company_name: string;
  license_number: string;
  license_expiry: string | null;
  phone: string | null;
  email: string;
  website: string | null;
  bio: string | null;
  logo_url: string | null;
  status: string;
  verified: boolean;
};

type AgentRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  verified: boolean;
  user_id: string;
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
  status: string;
  beds: number;
  baths: number;
  listed_by: string | null;
};

export default function BrokerDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [broker, setBroker] = useState<BrokerRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    company_name: "",
    license_number: "",
    license_expiry: "",
    phone: "",
    email: "",
    website: "",
    bio: "",
  });

  useEffect(() => {
    if (!user?.id || authLoading) return;
    void (async () => {
      const { data: b } = await supabase
        .from("brokers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      setBroker((b as BrokerRow | null) ?? null);
      setLoaded(true);

      if (b && b.status === "approved" && b.verified) {
        const { data: ag } = await supabase
          .from("agents")
          .select("id, name, email, status, verified, user_id")
          .eq("broker_id", b.id);
        const agentList = (ag as AgentRow[]) ?? [];
        setAgents(agentList);

        const { data: ld } = await supabase
          .from("leads")
          .select("id, name, email, stage, status, created_at, property_interest")
          .eq("broker_id", user.id)
          .order("created_at", { ascending: false });
        setLeads((ld as LeadRow[]) ?? []);

        const uniqueIds = [...new Set([user.id, ...agentList.map((a) => a.user_id)])];
        if (uniqueIds.length) {
          const { data: pr } = await supabase
            .from("properties")
            .select("id, location, price, beds, baths, listed_by")
            .in("listed_by", uniqueIds);
          setProperties((pr as PropertyRow[]) ?? []);
        } else {
          setProperties([]);
        }
      } else {
        setAgents([]);
        setLeads([]);
        setProperties([]);
      }
    })();
  }, [user?.id, authLoading, supabase]);

  // Derive form defaults from broker (avoid setState in effect body).
  const brokerFormDefaults = useMemo(() => {
    if (!broker) return null;
    return {
      name: broker.name,
      company_name: broker.company_name,
      license_number: broker.license_number,
      license_expiry: broker.license_expiry ?? "",
      phone: broker.phone ?? "",
      email: broker.email,
      website: broker.website ?? "",
      bio: broker.bio ?? "",
    };
  }, [broker]);

  useEffect(() => {
    if (!brokerFormDefaults) return;
    queueMicrotask(() => setForm(brokerFormDefaults));
  }, [brokerFormDefaults]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !broker) return;
    setSaveMsg("");
    const { error } = await supabase
      .from("brokers")
      .update({
        name: form.name.trim(),
        company_name: form.company_name.trim(),
        license_number: form.license_number.trim(),
        license_expiry: form.license_expiry.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim(),
        website: form.website.trim() || null,
        bio: form.bio.trim() || null,
      })
      .eq("user_id", user.id);
    if (error) {
      setSaveMsg(error.message);
      return;
    }
    const { data: b } = await supabase
      .from("brokers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setBroker((b as BrokerRow | null) ?? null);
    setEditOpen(false);
    setSaveMsg("Saved.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/signout";
  };

  if (authLoading || !loaded) {
    return (
      <div className="min-h-screen bg-[#f7f6f3] flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!broker) {
    return (
      <div className="min-h-screen bg-[#f7f6f3] px-4 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-black/8 bg-white p-8">
          <h1 className="font-serif text-xl text-gray-900">Broker dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            No brokerage is linked to this account yet.
          </p>
          <Link
            href="/register/broker"
            className="mt-6 inline-block rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white"
          >
            Register your brokerage
          </Link>
        </div>
      </div>
    );
  }

  const approved = broker.status === "approved" && broker.verified;
  const pending = broker.status === "pending";
  const rejected = broker.status === "rejected";

  return (
    <div className="min-h-screen bg-[#f7f6f3]">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="font-serif text-xl text-gray-900">Broker dashboard</h1>
            <p className="text-xs text-gray-500">{broker.company_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
              Home
            </Link>
            <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
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
            <LicenseExpiryBadge licenseExpiry={broker.license_expiry} />
          </div>
          {pending && (
            <p className="mt-3 text-sm text-gray-600">
              Your application is under review. We will notify you when it has been decided.
            </p>
          )}
          {rejected && (
            <p className="mt-3 text-sm text-gray-600">
              Your last application was not approved. You can update your details below and contact
              support if you need help.
            </p>
          )}
          {broker.license_expiry && (
            <p className="mt-2 text-xs text-gray-500">
              License expires {formatLicenseDate(broker.license_expiry)}
              {isLicenseExpiringWithinDays(broker.license_expiry, 30) && (
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
              <label className="text-xs text-gray-500 sm:col-span-2">
                Company name
                <input
                  required
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-gray-500">
                Contact name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
              <label className="text-xs text-gray-500 sm:col-span-2">
                Website
                <input
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
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
                Agents ({agents.length})
              </h2>
              {agents.length === 0 ? (
                <p className="text-sm text-gray-500">No agents linked to your brokerage yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {agents.map((a) => (
                    <li key={a.id} className="py-3 flex justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.name}</p>
                        <p className="text-xs text-gray-500">{a.email}</p>
                      </div>
                      <span className="text-xs capitalize text-gray-500">{a.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-black/8 bg-white p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Leads ({leads.length})
              </h2>
              {leads.length === 0 ? (
                <p className="text-sm text-gray-500">No leads assigned to you yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {leads.map((l) => (
                    <li key={String(l.id)} className="py-3">
                      <p className="text-sm font-medium text-gray-900">{l.name}</p>
                      <p className="text-xs text-gray-500">{l.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {l.stage ?? l.status ?? "new"}
                        {" · "}
                        {l.property_interest}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-black/8 bg-white p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">
                Properties ({properties.length})
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                Listings where you or your agents are set as{" "}
                <code className="rounded bg-gray-100 px-1">listed_by</code> in Admin.
              </p>
              {properties.length === 0 ? (
                <p className="text-sm text-gray-500">No listings linked yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {properties.map((p) => (
                    <li key={p.id} className="py-3 flex justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.location}</p>
                        <p className="text-xs text-gray-500">
                          {formatPropertyPriceDisplay(
                            p.price,
                            p.status as "for_sale" | "for_rent" | "sold" | "rented",
                          )}{" "}
                          · {p.beds} bd / {p.baths} ba
                        </p>
                      </div>
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

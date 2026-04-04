"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Calendar,
  Check,
  Home,
  LayoutDashboard,
  Loader2,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { AgentAnalyticsTab } from "@/components/dashboard/agent-analytics-tab";
import { AgentLeadSlideOver } from "@/components/dashboard/agent-lead-slideover";
import { AgentLeadTemplatesSection } from "@/components/dashboard/agent-lead-templates";
import { AgentViewingsTab } from "@/components/dashboard/agent-viewings-tab";
import { useAuth } from "@/contexts/auth-context";
import { VerifiedAgentBadge } from "@/components/marketplace/verified-agent-badge";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { LicenseExpiryBadge } from "@/components/LicenseExpiryBadge";
import { formatLicenseDate } from "@/lib/license-expiry";
import { listingLimitForTier } from "@/lib/agent-listing-limits";

type Tab = "overview" | "leads" | "viewings" | "listings" | "profile" | "analytics" | "notifications";

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
  specialties: string | null;
  service_areas: string | null;
  social_links: Record<string, string> | null;
  response_time?: string | null;
  closings?: number | null;
  listing_tier?: string | null;
};

type LeadRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  property_interest: string | null;
  message: string | null;
  stage: string;
  created_at: string;
  updated_at?: string;
};

type ViewingRow = {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  scheduled_at: string;
  status: string;
  property_id: string;
  notes: string | null;
  reminder_minutes?: number | null;
  reminder_sent?: boolean | null;
};

type PropertyRow = {
  id: string;
  name: string | null;
  location: string;
  price: string;
  image_url: string;
  status: "for_sale" | "for_rent";
};

/** UI labels → DB lead stages (existing check constraint). */
const LEAD_STAGE_OPTIONS = [
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Viewing Scheduled", value: "viewing" },
  { label: "Closed", value: "closed_won" },
  { label: "Lost", value: "closed_lost" },
] as const;

function labelForStage(stage: string): string {
  return LEAD_STAGE_OPTIONS.find((o) => o.value === stage)?.label ?? stage;
}

export function AgentDashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [tab, setTab] = useState<Tab>("overview");
  const [agent, setAgent] = useState<AgentRow | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("tab");
    const allowed: Tab[] = ["overview", "leads", "viewings", "listings", "profile", "analytics", "notifications"];
    if (raw && allowed.includes(raw as Tab)) setTab(raw as Tab);
  }, []);
  const [loaded, setLoaded] = useState(false);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [viewings, setViewings] = useState<ViewingRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    bio: "",
    specialties: "",
    serviceAreas: "",
    instagram: "",
    facebook: "",
    linkedin: "",
    website: "",
  });

  const [listingOpen, setListingOpen] = useState(false);
  const [listingLimitModalOpen, setListingLimitModalOpen] = useState(false);
  const [listingForm, setListingForm] = useState({
    location: "",
    name: "",
    price: "",
    beds: "2",
    baths: "2",
    sqft: "1,000",
    description: "",
    image_url: "",
    property_type: "Condo",
    listing_type: "sale" as "sale" | "rent",
  });

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    const { data: a } = await supabase.from("agents").select("*").eq("user_id", user.id).maybeSingle();
    setAgent((a as AgentRow | null) ?? null);
    setLoaded(true);
    if (!a) return;

    if (a.status === "approved" && a.verified) {
      const [{ data: ld }, { data: pr }, vwRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, name, email, phone, property_interest, message, stage, created_at, updated_at")
          .eq("agent_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("properties")
          .select("id, name, location, price, image_url, status")
          .eq("listed_by", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("viewing_requests")
          .select("*")
          .eq("agent_user_id", user.id)
          .order("scheduled_at", { ascending: true }),
      ]);
      setLeads((ld as LeadRow[]) ?? []);
      setProperties((pr as PropertyRow[]) ?? []);
      setViewings(vwRes.error ? [] : ((vwRes.data as ViewingRow[]) ?? []));
    } else {
      setLeads([]);
      setProperties([]);
      setViewings([]);
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/auth/login?next=/dashboard/agent");
      return;
    }
    void loadData();
  }, [authLoading, user, router, loadData]);

  useEffect(() => {
    if (!agent) return;
    const sl = (agent.social_links ?? {}) as Record<string, string>;
    setProfileForm({
      name: agent.name,
      phone: agent.phone ?? "",
      bio: agent.bio ?? "",
      specialties: agent.specialties ?? "",
      serviceAreas: agent.service_areas ?? "",
      instagram: sl.instagram ?? "",
      facebook: sl.facebook ?? "",
      linkedin: sl.linkedin ?? "",
      website: sl.website ?? "",
    });
  }, [agent]);

  const approved = agent?.status === "approved" && agent?.verified;

  const listingLimit = useMemo(() => listingLimitForTier(agent?.listing_tier), [agent?.listing_tier]);
  const atListingLimit = approved && properties.length >= listingLimit;

  const openNewListingFlow = () => {
    if (atListingLimit) {
      setListingLimitModalOpen(true);
      return;
    }
    setListingOpen(true);
  };

  const profileComplete = useMemo(() => {
    if (!agent) return { pct: 0, checks: [] as { ok: boolean; label: string }[] };
    const checks = [
      { ok: !!agent.image_url?.trim(), label: "Profile photo" },
      { ok: !!(agent.bio && agent.bio.trim().length > 20), label: "Bio" },
      { ok: !!(agent.specialties && agent.specialties.trim().length > 0), label: "Specialties" },
      { ok: properties.length >= 1, label: "At least one listing" },
    ];
    const done = checks.filter((c) => c.ok).length;
    const pct = Math.round((done / checks.length) * 100);
    return { pct, checks };
  }, [agent, properties.length]);

  const newLeadsCount = useMemo(() => leads.filter((l) => l.stage === "new").length, [leads]);

  const mockProfileViews = useMemo(() => 120 + (agent?.id ? agent.id.charCodeAt(0) % 380 : 0), [agent?.id]);
  const mockResponseRate = useMemo(() => 85 + (agent?.id ? agent.id.charCodeAt(1) % 14 : 0), [agent?.id]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !agent) return;
    setSaving(true);
    setMsg("");
    const social_links = {
      instagram: profileForm.instagram.trim() || undefined,
      facebook: profileForm.facebook.trim() || undefined,
      linkedin: profileForm.linkedin.trim() || undefined,
      website: profileForm.website.trim() || undefined,
    };
    const { error } = await supabase
      .from("agents")
      .update({
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim() || null,
        bio: profileForm.bio.trim() || null,
        specialties: profileForm.specialties.trim() || null,
        service_areas: profileForm.serviceAreas.trim() || null,
        social_links,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Profile saved.");
    await loadData();
  };

  const uploadAvatar = async (file: File) => {
    if (!user?.id || !agent) return;
    setSaving(true);
    setMsg("");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("agent-avatars").upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });
    if (upErr) {
      setSaving(false);
      setMsg(upErr.message);
      return;
    }
    const { data: pub } = supabase.storage.from("agent-avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error } = await supabase.from("agents").update({ image_url: url }).eq("user_id", user.id);
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Photo updated.");
    await loadData();
  };

  const updateLeadStage = async (leadId: number, stage: string) => {
    const { error } = await supabase.from("leads").update({ stage }).eq("id", leadId);
    if (error) {
      setMsg(error.message);
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage } : l)));
    setSelectedLead((s) => (s && s.id === leadId ? { ...s, stage } : s));
  };

  const createListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (properties.length >= listingLimit) {
      setListingOpen(false);
      setListingLimitModalOpen(true);
      return;
    }
    setSaving(true);
    setMsg("");
    const beds = Number(listingForm.beds) || 0;
    const baths = Number(listingForm.baths) || 0;
    const { error } = await supabase.from("properties").insert({
      name: listingForm.name.trim() || null,
      location: listingForm.location.trim(),
      price: listingForm.price.trim(),
      sqft: listingForm.sqft.trim(),
      beds,
      baths,
      image_url: listingForm.image_url.trim() || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&h=800&fit=crop",
      status: listingForm.listing_type === "sale" ? "for_sale" : "for_rent",
      listed_by: user.id,
      property_type: listingForm.property_type,
      description: listingForm.description.trim() || null,
    });
    setSaving(false);
    if (error) {
      if (/row-level security|violates row-level security policy/i.test(error.message)) {
        setListingLimitModalOpen(true);
        setMsg("");
      } else {
        setMsg(error.message);
      }
      return;
    }
    setListingOpen(false);
    setListingForm({
      location: "",
      name: "",
      price: "",
      beds: "2",
      baths: "2",
      sqft: "1,000",
      description: "",
      image_url: "",
      property_type: "Condo",
      listing_type: "sale",
    });
    await loadData();
    setMsg("Listing created.");
    setTab("listings");
  };

  if (authLoading || !loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] text-sm font-semibold text-[#2C2C2C]/60">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#7C9A7E]" />
        Loading…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] px-4 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 shadow-sm">
          <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">Agent dashboard</h1>
          <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/55">
            No agent profile is linked to this account yet.
          </p>
          <Link
            href="/register/agent"
            className="mt-6 inline-flex rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#7C9A7E]"
          >
            Become an Agent
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-5 w-5" /> },
    { id: "leads", label: "Leads", icon: <Users className="h-5 w-5" /> },
    { id: "viewings", label: "Viewings", icon: <Calendar className="h-5 w-5" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-5 w-5" /> },
    { id: "listings", label: "Listings", icon: <Home className="h-5 w-5" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="h-5 w-5" /> },
    { id: "profile", label: "Profile", icon: <Settings className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-20 md:pb-8">
      <div className="mx-auto flex max-w-6xl flex-col md:flex-row">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-[#2C2C2C]/10 bg-[#FAF8F4] md:sticky md:top-0 md:flex md:h-screen md:flex-col md:px-4 md:py-8">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-[#C9A84C]/35">
              {agent.image_url ? (
                <Image src={agent.image_url} alt="" fill className="object-cover" sizes="56px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#7C9A7E]/20 text-lg font-bold text-[#2C2C2C]">
                  {agent.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#2C2C2C]">{agent.name}</p>
              <VerifiedAgentBadge show={agent.verified} />
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  tab === t.id
                    ? "bg-[#7C9A7E]/15 text-[#2C2C2C] ring-1 ring-[#C9A84C]/25"
                    : "text-[#2C2C2C]/65 hover:bg-white/80"
                }`}
              >
                <span className="text-[#7C9A7E]">{t.icon}</span>
                {t.label}
                {t.id === "leads" && newLeadsCount > 0 ? (
                  <span className="ml-auto rounded-full bg-[#C9A84C]/25 px-2 py-0.5 text-xs font-bold text-[#8a6d32]">
                    {newLeadsCount}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
          <Link
            href="/"
            className="mt-auto px-3 py-2 text-sm font-semibold text-[#2C2C2C]/55 hover:text-[#2C2C2C]"
          >
            ← Back to site
          </Link>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-10">
          {msg ? (
            <p className="mb-4 rounded-xl border border-[#C9A84C]/30 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]">
              {msg}
            </p>
          ) : null}

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "overview" && (
                <OverviewTab
                  agent={agent}
                  approved={!!approved}
                  leads={leads}
                  properties={properties}
                  profileComplete={profileComplete}
                  mockProfileViews={mockProfileViews}
                  mockResponseRate={mockResponseRate}
                  listingLimit={listingLimit}
                  atListingLimit={atListingLimit}
                />
              )}
              {tab === "leads" && approved && (
                <>
                  <LeadsTab leads={leads} onSelect={setSelectedLead} onStageChange={updateLeadStage} />
                  <AgentLeadTemplatesSection
                    leadEmail={selectedLead?.email}
                    leadName={selectedLead?.name}
                  />
                </>
              )}
              {tab === "leads" && !approved && (
                <p className="text-sm font-semibold text-[#2C2C2C]/55">Leads unlock when your profile is verified.</p>
              )}
              {tab === "viewings" && approved && (
                <AgentViewingsTab
                  viewings={viewings}
                  properties={properties}
                  saving={saving}
                  onAfterAction={loadData}
                />
              )}
              {tab === "viewings" && !approved && (
                <p className="text-sm font-semibold text-[#2C2C2C]/55">Viewings unlock when verified.</p>
              )}
              {tab === "analytics" && approved && (
                <AgentAnalyticsTab leads={leads} viewings={viewings} agent={agent} />
              )}
              {tab === "analytics" && !approved && (
                <p className="text-sm font-semibold text-[#2C2C2C]/55">Analytics unlock when verified.</p>
              )}
              {tab === "listings" && approved && (
                <ListingsTab
                  properties={properties}
                  listingOpen={listingOpen}
                  setListingOpen={setListingOpen}
                  listingForm={listingForm}
                  setListingForm={setListingForm}
                  onSubmit={createListing}
                  saving={saving}
                  listingLimit={listingLimit}
                  onOpenNewListing={openNewListingFlow}
                />
              )}
              {tab === "listings" && !approved && (
                <p className="text-sm font-semibold text-[#2C2C2C]/55">Listings unlock when verified.</p>
              )}
              {tab === "notifications" && user && (
                <AgentNotificationsTab userId={user.id} supabase={supabase} />
              )}
              {tab === "profile" && (
                <ProfileTab
                  agent={agent}
                  profileForm={profileForm}
                  setProfileForm={setProfileForm}
                  onSave={saveProfile}
                  saving={saving}
                  onUpload={uploadAvatar}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[#2C2C2C]/10 bg-[#FAF8F4]/95 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[10px] font-bold ${
              tab === t.id ? "text-[#7C9A7E]" : "text-[#2C2C2C]/45"
            }`}
          >
            <span className={tab === t.id ? "text-[#7C9A7E]" : "text-[#2C2C2C]/45"}>{t.icon}</span>
            {t.label}
            {t.id === "leads" && newLeadsCount > 0 ? (
              <span className="absolute right-2 top-0 h-2 w-2 rounded-full bg-[#C9A84C]" />
            ) : null}
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {listingLimitModalOpen ? (
          <ListingLimitUpgradeModal
            onClose={() => setListingLimitModalOpen(false)}
            isProTier={agent.listing_tier === "pro"}
            listingLimit={listingLimit}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selectedLead && user ? (
          <AgentLeadSlideOver
            lead={selectedLead}
            agentUserId={user.id}
            agentAvatarUrl={agent.image_url}
            agentName={agent.name}
            onClose={() => setSelectedLead(null)}
            onStageChange={updateLeadStage}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function OverviewTab({
  agent,
  approved,
  leads,
  properties,
  profileComplete,
  mockProfileViews,
  mockResponseRate,
  listingLimit,
  atListingLimit,
}: {
  agent: AgentRow;
  approved: boolean;
  leads: LeadRow[];
  properties: PropertyRow[];
  profileComplete: { pct: number; checks: { ok: boolean; label: string }[] };
  mockProfileViews: number;
  mockResponseRate: number;
  listingLimit: number;
  atListingLimit: boolean;
}) {
  const recent = leads.slice(0, 5);
  const incomplete = profileComplete.pct < 100;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Overview</h1>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">Welcome back, {agent.name.split(" ")[0]}.</p>
      </div>

      {!approved ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm font-semibold text-amber-950">
          Your agent application is {agent.status === "pending" ? "pending review" : agent.status}. Dashboard tools
          unlock once you are verified.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Leads" value={String(leads.length)} />
        <StatCard label="Active Listings" value={String(properties.length)} />
        <StatCard label="Profile Views" value={String(mockProfileViews)} hint="mock" />
        <StatCard label="Response Rate" value={`${mockResponseRate}%`} hint="mock" />
      </div>

      {approved ? (
        <div
          className={`rounded-2xl border bg-white p-5 shadow-sm ${
            atListingLimit ? "border-[#C9A84C]/50 ring-1 ring-[#C9A84C]/25" : "border-[#2C2C2C]/10"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className={`text-sm font-bold ${atListingLimit ? "text-[#8a6d32]" : "text-[#2C2C2C]"}`}
            >
              Listing usage
            </p>
            <p
              className={`text-sm font-bold tabular-nums ${atListingLimit ? "text-[#B8860B]" : "text-[#2C2C2C]/80"}`}
            >
              {properties.length}/{listingLimit} listings used
            </p>
          </div>
          <div
            className={`mt-3 h-2.5 w-full overflow-hidden rounded-full ${
              atListingLimit ? "bg-[#C9A84C]/25" : "bg-[#EBE6DC]"
            }`}
          >
            <div
              className={`h-full rounded-full transition-all ${
                atListingLimit
                  ? "bg-gradient-to-r from-[#D4AF37] to-[#C9A84C]"
                  : "bg-gradient-to-r from-[#7C9A7E] to-[#C9A84C]/90"
              }`}
              style={{
                width: `${listingLimit > 0 ? Math.min(100, (properties.length / listingLimit) * 100) : 0}%`,
              }}
            />
          </div>
          {atListingLimit ? (
            <p className="mt-3 text-xs font-semibold text-[#8a6d32]">
              You are at your plan limit. Upgrade to Pro on the{" "}
              <Link href="/pricing" className="underline underline-offset-2 hover:text-[#2C2C2C]">
                pricing page
              </Link>{" "}
              to list more properties.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-[#2C2C2C]">Profile completeness</p>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#EBE6DC]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7C9A7E] to-[#C9A84C] transition-all"
            style={{ width: `${profileComplete.pct}%` }}
          />
        </div>
        <ul className="mt-4 space-y-2">
          {profileComplete.checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm font-semibold text-[#2C2C2C]/75">
              <span className={c.ok ? "text-[#7C9A7E]" : "text-[#2C2C2C]/25"}>
                {c.ok ? <Check className="h-4 w-4" /> : "○"}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
        {incomplete && approved ? (
          <p className="mt-4 rounded-xl bg-[#C9A84C]/12 px-4 py-3 text-sm font-semibold text-[#8a6d32]">
            Complete your profile to get more leads — add a photo, bio, specialties, and your first listing.
          </p>
        ) : null}
      </div>

      {approved ? (
        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="font-serif text-lg font-bold text-[#2C2C2C]">Recent leads</p>
            <span className="text-xs font-semibold text-[#2C2C2C]/45">Last 5</span>
          </div>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm font-semibold text-[#2C2C2C]/45">No leads yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-[#2C2C2C]/10">
              {recent.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-[#2C2C2C]">{l.name}</p>
                    <p className="text-xs font-semibold text-[#2C2C2C]/45">{l.email}</p>
                  </div>
                  <span className="rounded-full bg-[#7C9A7E]/12 px-2 py-1 text-xs font-bold text-[#2C2C2C]/70">
                    {labelForStage(l.stage)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#2C2C2C]/45">{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold text-[#2C2C2C]">{value}</p>
      {hint ? <p className="mt-1 text-[10px] font-semibold text-[#C9A84C]">{hint}</p> : null}
    </div>
  );
}

function LeadsTab({
  leads,
  onSelect,
  onStageChange,
}: {
  leads: LeadRow[];
  onSelect: (l: LeadRow) => void;
  onStageChange: (id: number, stage: string) => void;
}) {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Leads</h1>
      <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">Manage pipeline and follow-ups.</p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
            <tr>
              <th className="px-4 py-3 font-bold text-[#2C2C2C]">Client</th>
              <th className="px-4 py-3 font-bold text-[#2C2C2C]">Email</th>
              <th className="px-4 py-3 font-bold text-[#2C2C2C]">Phone</th>
              <th className="px-4 py-3 font-bold text-[#2C2C2C]">Interest</th>
              <th className="px-4 py-3 font-bold text-[#2C2C2C]">Date</th>
              <th className="px-4 py-3 font-bold text-[#2C2C2C]">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr
                key={l.id}
                className="cursor-pointer border-b border-[#2C2C2C]/5 hover:bg-[#FAF8F4]/80"
                onClick={() => onSelect(l)}
              >
                <td className="px-4 py-3 font-semibold text-[#2C2C2C]">{l.name}</td>
                <td className="px-4 py-3 text-[#2C2C2C]/70">{l.email}</td>
                <td className="px-4 py-3 text-[#2C2C2C]/70">{l.phone ?? "—"}</td>
                <td className="max-w-[200px] truncate px-4 py-3 text-[#2C2C2C]/70">{l.property_interest ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-[#2C2C2C]/55">
                  {new Date(l.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={l.stage}
                    onChange={(e) => onStageChange(l.id, e.target.value)}
                    className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs font-semibold"
                  >
                    {LEAD_STAGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 ? (
          <p className="p-8 text-center text-sm font-semibold text-[#2C2C2C]/45">No leads assigned.</p>
        ) : null}
      </div>
    </div>
  );
}

function ListingsTab({
  properties,
  listingOpen,
  setListingOpen,
  listingForm,
  setListingForm,
  onSubmit,
  saving,
  listingLimit,
  onOpenNewListing,
}: {
  properties: PropertyRow[];
  listingOpen: boolean;
  setListingOpen: (v: boolean) => void;
  listingForm: {
    location: string;
    name: string;
    price: string;
    beds: string;
    baths: string;
    sqft: string;
    description: string;
    image_url: string;
    property_type: string;
    listing_type: "sale" | "rent";
  };
  setListingForm: React.Dispatch<React.SetStateAction<typeof listingForm>>;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  listingLimit: number;
  onOpenNewListing: () => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Listings</h1>
          <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
            Properties you list ({properties.length}/{listingLimit}).
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenNewListing}
          className="rounded-full bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#2C2C2C] shadow-sm hover:brightness-95"
        >
          Add New Listing
        </button>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((p) => (
          <Link
            key={p.id}
            href={`/properties/${encodeURIComponent(p.id)}`}
            className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm transition hover:shadow-md"
          >
            <div className="relative h-40 w-full bg-black/5">
              <Image src={p.image_url} alt="" fill className="object-cover" sizes="400px" />
              <span className="absolute left-2 top-2 rounded-full bg-[#7C9A7E] px-2 py-1 text-[10px] font-bold text-white">
                {p.status === "for_rent" ? "For Rent" : "For Sale"}
              </span>
            </div>
            <div className="p-4">
              <p className="font-semibold text-[#2C2C2C]">{p.location}</p>
              <p className="mt-1 font-serif text-lg font-bold text-[#2C2C2C]">{p.price}</p>
            </div>
          </Link>
        ))}
      </div>

      <AnimatePresence>
        {listingOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            onClick={() => setListingOpen(false)}
          >
            <motion.form
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onSubmit={onSubmit}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#FAF8F4] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">New listing</h2>
                <button type="button" onClick={() => setListingOpen(false)} className="rounded-full p-2 hover:bg-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Location
                  <input
                    required
                    value={listingForm.location}
                    onChange={(e) => setListingForm((f) => ({ ...f, location: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Title (optional)
                  <input
                    value={listingForm.name}
                    onChange={(e) => setListingForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Price
                  <input
                    required
                    value={listingForm.price}
                    onChange={(e) => setListingForm((f) => ({ ...f, price: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                    placeholder="₱12M"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                    Beds
                    <input
                      type="number"
                      min={0}
                      value={listingForm.beds}
                      onChange={(e) => setListingForm((f) => ({ ...f, beds: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                    Baths
                    <input
                      type="number"
                      min={0}
                      value={listingForm.baths}
                      onChange={(e) => setListingForm((f) => ({ ...f, baths: e.target.value }))}
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                    />
                  </label>
                </div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Sqft
                  <input
                    value={listingForm.sqft}
                    onChange={(e) => setListingForm((f) => ({ ...f, sqft: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Property type
                  <select
                    value={listingForm.property_type}
                    onChange={(e) => setListingForm((f) => ({ ...f, property_type: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  >
                    {["House", "Condo", "Villa", "Townhouse", "Land", "Studio"].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Listing type
                  <select
                    value={listingForm.listing_type}
                    onChange={(e) =>
                      setListingForm((f) => ({
                        ...f,
                        listing_type: e.target.value === "rent" ? "rent" : "sale",
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  >
                    <option value="sale">For sale</option>
                    <option value="rent">For rent</option>
                  </select>
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Image URL
                  <input
                    value={listingForm.image_url}
                    onChange={(e) => setListingForm((f) => ({ ...f, image_url: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                    placeholder="https://..."
                  />
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                  Description
                  <textarea
                    value={listingForm.description}
                    onChange={(e) => setListingForm((f) => ({ ...f, description: e.target.value }))}
                    rows={4}
                    className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="mt-6 w-full rounded-full bg-[#2C2C2C] py-3 text-sm font-bold text-white hover:bg-[#7C9A7E] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save listing"}
              </button>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ProfileTab({
  agent,
  profileForm,
  setProfileForm,
  onSave,
  saving,
  onUpload,
}: {
  agent: AgentRow;
  profileForm: {
    name: string;
    phone: string;
    bio: string;
    specialties: string;
    serviceAreas: string;
    instagram: string;
    facebook: string;
    linkedin: string;
    website: string;
  };
  setProfileForm: React.Dispatch<React.SetStateAction<typeof profileForm>>;
  onSave: (e: React.FormEvent) => void;
  saving: boolean;
  onUpload: (file: File) => void;
}) {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Profile settings</h1>
      <form onSubmit={onSave} className="mt-8 max-w-xl space-y-5 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Photo</p>
          <div className="mt-2 flex items-center gap-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-full bg-[#EBE6DC] ring-2 ring-[#C9A84C]/30">
              {agent.image_url ? <Image src={agent.image_url} alt="" fill className="object-cover" sizes="80px" /> : null}
            </div>
            <label className="cursor-pointer rounded-full border border-[#7C9A7E] bg-[#7C9A7E]/10 px-4 py-2 text-sm font-semibold text-[#2C2C2C] hover:bg-[#7C9A7E]/20">
              Upload
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                }}
              />
            </label>
          </div>
        </div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
          Name
          <input
            required
            value={profileForm.name}
            onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
          Phone
          <input
            value={profileForm.phone}
            onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
          />
        </label>
        <div className="rounded-xl bg-[#FAF8F4] px-4 py-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">License (read-only)</p>
          <p className="mt-1 font-semibold text-[#2C2C2C]">{agent.license_number}</p>
          <p className="mt-1 text-xs font-semibold text-[#2C2C2C]/55">
            Expires: {agent.license_expiry ? formatLicenseDate(agent.license_expiry) : "—"}
          </p>
          <LicenseExpiryBadge licenseExpiry={agent.license_expiry} />
        </div>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
          Bio
          <textarea
            value={profileForm.bio}
            onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
            rows={4}
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
          Specialties (comma-separated)
          <input
            value={profileForm.specialties}
            onChange={(e) => setProfileForm((f) => ({ ...f, specialties: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
          Service areas
          <input
            value={profileForm.serviceAreas}
            onChange={(e) => setProfileForm((f) => ({ ...f, serviceAreas: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
            placeholder="Makati, BGC, Cebu…"
          />
        </label>
        <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Social links</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Instagram URL"
            value={profileForm.instagram}
            onChange={(e) => setProfileForm((f) => ({ ...f, instagram: e.target.value }))}
            className="rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
          />
          <input
            placeholder="Facebook URL"
            value={profileForm.facebook}
            onChange={(e) => setProfileForm((f) => ({ ...f, facebook: e.target.value }))}
            className="rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
          />
          <input
            placeholder="LinkedIn URL"
            value={profileForm.linkedin}
            onChange={(e) => setProfileForm((f) => ({ ...f, linkedin: e.target.value }))}
            className="rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
          />
          <input
            placeholder="Website"
            value={profileForm.website}
            onChange={(e) => setProfileForm((f) => ({ ...f, website: e.target.value }))}
            className="rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2 text-sm font-semibold"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-[#2C2C2C] py-3 text-sm font-bold text-white hover:bg-[#7C9A7E] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}

type AgentNotifRow = {
  id: string;
  created_at: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
};

function notificationListIcon(type: string) {
  if (type === "property_match") return <Home className="h-4 w-4 text-[#7C9A7E]" />;
  if (type === "lead_created") return <Sparkles className="h-4 w-4 text-[#C9A84C]" />;
  return <Bell className="h-4 w-4 text-[#2C2C2C]/50" />;
}

function notificationTimeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function AgentNotificationsTab({
  userId,
  supabase,
}: {
  userId: string;
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
}) {
  const [rows, setRows] = useState<AgentNotifRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, created_at, type, title, body, read_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setRows((data ?? []) as AgentNotifRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, supabase]);

  const markRead = async (n: AgentNotifRow) => {
    if (n.read_at) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", n.id);
    if (error) return;
    setRows((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
  };

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Notifications</h1>
      <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">Updates from BahayGo and your activity.</p>
      {loading ? (
        <p className="mt-8 text-sm font-semibold text-[#2C2C2C]/45">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 text-center text-sm font-semibold text-[#2C2C2C]/45">
          No new notifications
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-[#2C2C2C]/10 rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
          {rows.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => void markRead(n)}
                className={`flex w-full gap-3 px-4 py-4 text-left transition hover:bg-[#FAF8F4] ${n.read_at ? "opacity-75" : ""}`}
              >
                <span className="mt-0.5 shrink-0">{notificationListIcon(n.type)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#2C2C2C]">{n.title}</span>
                  {n.body ? (
                    <span className="mt-1 line-clamp-3 block text-xs font-semibold text-[#2C2C2C]/55">{n.body}</span>
                  ) : null}
                  <span className="mt-1 block text-[10px] font-semibold text-[#2C2C2C]/40">
                    {notificationTimeAgo(n.created_at)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingLimitUpgradeModal({
  onClose,
  isProTier,
  listingLimit,
}: {
  onClose: () => void;
  isProTier: boolean;
  listingLimit: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[#C9A84C]/35 bg-[#FAF8F4] p-6 shadow-2xl"
      >
        <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">
          {isProTier
            ? `You've reached your plan limit of ${listingLimit} listings`
            : "You've reached your free limit of 3 listings"}
        </h2>
        {isProTier ? (
          <p className="mt-3 text-sm font-semibold leading-relaxed text-[#2C2C2C]/70">
            Remove or archive a listing before adding another, or contact support if you need a higher limit.
          </p>
        ) : (
          <p className="mt-3 text-sm font-semibold leading-relaxed text-[#2C2C2C]/70">
            Upgrade to Pro for ₱999/month to list up to 20 properties.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="order-2 rounded-full border border-[#2C2C2C]/15 bg-white px-5 py-2.5 text-sm font-bold text-[#2C2C2C] hover:bg-[#FAF8F4] sm:order-1"
          >
            Cancel
          </button>
          {!isProTier ? (
            <Link
              href="/pricing"
              onClick={onClose}
              className="order-1 inline-flex items-center justify-center rounded-full bg-[#C9A84C] px-5 py-2.5 text-sm font-bold text-[#2C2C2C] shadow-sm hover:brightness-95 sm:order-2"
            >
              Upgrade Now
            </Link>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

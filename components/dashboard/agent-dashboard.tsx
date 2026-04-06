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
import { ListingLimitUpgradeModal } from "@/components/marketplace/listing-limit-upgrade-modal";
import { formatListingPricePhp } from "@/lib/format-listing-price";
import {
  AGENT_AVAILABILITY_NOW,
  AGENT_AVAILABILITY_OFFLINE,
} from "@/components/marketplace/agent-availability-badge";
import { AgentAvailabilitySchedule } from "@/components/dashboard/agent-availability-schedule";

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
  availability_schedule?: unknown;
  availability?: string | null;
  updated_at?: string | null;
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
  /** True when connected via property_agents but not the listing owner. */
  isCoHost?: boolean;
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
  const [deletingPropertyId, setDeletingPropertyId] = useState<string | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<number | null>(null);

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
      const [{ data: ld }, { data: owned }, { data: paRows }, vwRes] = await Promise.all([
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
        supabase.from("property_agents").select("property_id").eq("agent_id", a.id),
        supabase
          .from("viewing_requests")
          .select("*")
          .eq("agent_user_id", user.id)
          .order("scheduled_at", { ascending: true }),
      ]);
      setLeads((ld as LeadRow[]) ?? []);

      const ownedList = (owned ?? []) as PropertyRow[];
      const ownedIds = new Set(ownedList.map((p) => p.id));
      const coIds = [
        ...new Set((paRows ?? []).map((r) => (r as { property_id: string }).property_id)),
      ].filter((id) => !ownedIds.has(id));

      let cohosted: PropertyRow[] = [];
      if (coIds.length > 0) {
        const { data: co } = await supabase
          .from("properties")
          .select("id, name, location, price, image_url, status")
          .in("id", coIds)
          .order("created_at", { ascending: false });
        cohosted = ((co ?? []) as PropertyRow[]).map((p) => ({ ...p, isCoHost: true }));
      }

      const merged: PropertyRow[] = [
        ...ownedList.map((p) => ({ ...p, isCoHost: false })),
        ...cohosted,
      ];
      setProperties(merged);
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

  const ownedListingCount = useMemo(
    () => properties.filter((p) => !p.isCoHost).length,
    [properties],
  );

  const listingLimit = useMemo(() => listingLimitForTier(agent?.listing_tier), [agent?.listing_tier]);
  const atListingLimit = approved && ownedListingCount >= listingLimit;

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

  const deleteListing = async (propertyId: string) => {
    if (!user?.id) return;
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setDeletingPropertyId(propertyId);
    const { error } = await supabase
      .from("properties")
      .delete()
      .eq("id", propertyId)
      .eq("listed_by", user.id);
    setDeletingPropertyId(null);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Listing deleted.");
    await loadData();
  };

  const deleteLead = async (leadId: number) => {
    if (!user?.id) return;
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setDeletingLeadId(leadId);
    const { error } = await supabase.from("leads").delete().eq("id", leadId).eq("agent_id", user.id);
    setDeletingLeadId(null);
    if (error) {
      setMsg(error.message);
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setSelectedLead((s) => (s?.id === leadId ? null : s));
    setMsg("Lead removed.");
  };

  const createListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (ownedListingCount >= listingLimit) {
      setListingOpen(false);
      setListingLimitModalOpen(true);
      return;
    }
    setSaving(true);
    setMsg("");
    const beds = Number(listingForm.beds) || 0;
    const baths = Number(listingForm.baths) || 0;
    const { data: newProperty, error } = await supabase
      .from("properties")
      .insert({
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
      })
      .select("id")
      .single();
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
    if (newProperty?.id && agent?.id) {
      const { error: linkErr } = await supabase.from("property_agents").insert({
        property_id: newProperty.id,
        agent_id: agent.id,
      });
      if (linkErr && linkErr.code !== "23505") {
        setMsg(`Listing saved, but connected-agent link failed: ${linkErr.message}`);
      }
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
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-[#6B9E6E]" />
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
            className="mt-6 inline-flex rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E]"
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
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-[#D4A843]/35">
              {agent.image_url ? (
                <Image src={agent.image_url} alt="" fill className="object-cover" sizes="56px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#6B9E6E]/20 text-lg font-bold text-[#2C2C2C]">
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
                    ? "bg-[#6B9E6E]/15 text-[#2C2C2C] ring-1 ring-[#D4A843]/25"
                    : "text-[#2C2C2C]/65 hover:bg-white/80"
                }`}
              >
                <span className="text-[#6B9E6E]">{t.icon}</span>
                {t.label}
                {t.id === "leads" && newLeadsCount > 0 ? (
                  <span className="ml-auto rounded-full bg-[#D4A843]/25 px-2 py-0.5 text-xs font-bold text-[#8a6d32]">
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
            <p className="mb-4 rounded-xl border border-[#D4A843]/30 bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C]">
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
                  ownedListingCount={ownedListingCount}
                  profileComplete={profileComplete}
                  mockProfileViews={mockProfileViews}
                  mockResponseRate={mockResponseRate}
                  listingLimit={listingLimit}
                  atListingLimit={atListingLimit}
                />
              )}
              {tab === "leads" && approved && (
                <>
                  <LeadsTab
                    leads={leads}
                    onSelect={setSelectedLead}
                    onStageChange={updateLeadStage}
                    onDeleteLead={deleteLead}
                    deletingLeadId={deletingLeadId}
                  />
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
                  ownedListingCount={ownedListingCount}
                  listingOpen={listingOpen}
                  setListingOpen={setListingOpen}
                  listingForm={listingForm}
                  setListingForm={setListingForm}
                  onSubmit={createListing}
                  saving={saving}
                  listingLimit={listingLimit}
                  onOpenNewListing={openNewListingFlow}
                  onDeleteProperty={deleteListing}
                  deletingPropertyId={deletingPropertyId}
                />
              )}
              {tab === "listings" && !approved && (
                <p className="text-sm font-semibold text-[#2C2C2C]/55">Listings unlock when verified.</p>
              )}
              {tab === "notifications" && user && (
                <AgentNotificationsTab userId={user.id} supabase={supabase} />
              )}
              {tab === "profile" && user && agent && (
                <ProfileTab
                  agent={agent}
                  profileForm={profileForm}
                  setProfileForm={setProfileForm}
                  onSave={saveProfile}
                  saving={saving}
                  onUpload={uploadAvatar}
                  supabase={supabase}
                  userId={user.id}
                  onAvailabilitySaved={loadData}
                  onAvailabilityMessage={setMsg}
                />
              )}
              {tab === "profile" && user && !agent && loaded && (
                <p className="text-sm font-semibold text-[#2C2C2C]/55">No agent profile found.</p>
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
              tab === t.id ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"
            }`}
          >
            <span className={tab === t.id ? "text-[#6B9E6E]" : "text-[#2C2C2C]/45"}>{t.icon}</span>
            {t.label}
            {t.id === "leads" && newLeadsCount > 0 ? (
              <span className="absolute right-2 top-0 h-2 w-2 rounded-full bg-[#D4A843]" />
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
  ownedListingCount,
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
  ownedListingCount: number;
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
            atListingLimit ? "border-[#D4A843]/50 ring-1 ring-[#D4A843]/25" : "border-[#2C2C2C]/10"
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
              {ownedListingCount}/{listingLimit} listings used
            </p>
          </div>
          <div
            className={`mt-3 h-2.5 w-full overflow-hidden rounded-full ${
              atListingLimit ? "bg-[#D4A843]/25" : "bg-[#EBE6DC]"
            }`}
          >
            <div
              className={`h-full rounded-full transition-all ${
                atListingLimit
                  ? "bg-gradient-to-r from-[#D4AF37] to-[#D4A843]"
                  : "bg-gradient-to-r from-[#6B9E6E] to-[#D4A843]/90"
              }`}
              style={{
                width: `${listingLimit > 0 ? Math.min(100, (ownedListingCount / listingLimit) * 100) : 0}%`,
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
            className="h-full rounded-full bg-gradient-to-r from-[#6B9E6E] to-[#D4A843] transition-all"
            style={{ width: `${profileComplete.pct}%` }}
          />
        </div>
        <ul className="mt-4 space-y-2">
          {profileComplete.checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm font-semibold text-[#2C2C2C]/75">
              <span className={c.ok ? "text-[#6B9E6E]" : "text-[#2C2C2C]/25"}>
                {c.ok ? <Check className="h-4 w-4" /> : "○"}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
        {incomplete && approved ? (
          <p className="mt-4 rounded-xl bg-[#D4A843]/12 px-4 py-3 text-sm font-semibold text-[#8a6d32]">
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
                  <span className="rounded-full bg-[#6B9E6E]/12 px-2 py-1 text-xs font-bold text-[#2C2C2C]/70">
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
      {hint ? <p className="mt-1 text-[10px] font-semibold text-[#D4A843]">{hint}</p> : null}
    </div>
  );
}

function LeadsTab({
  leads,
  onSelect,
  onStageChange,
  onDeleteLead,
  deletingLeadId,
}: {
  leads: LeadRow[];
  onSelect: (l: LeadRow) => void;
  onStageChange: (id: number, stage: string) => void;
  onDeleteLead: (id: number) => void | Promise<void>;
  deletingLeadId: number | null;
}) {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Leads</h1>
      <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">Manage pipeline and follow-ups.</p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
            <tr>
              <th className="px-4 py-3 font-bold text-[#2C2C2C]">Client</th>
              <th className="px-4 py-3 font-bold text-[#2C2C2C]">Email</th>
              <th className="px-4 py-3 font-bold text-[#2C2C2C]">Phone</th>
              <th className="px-4 py-3 font-bold text-[#2C2C2C]">Interest</th>
              <th className="px-4 py-3 font-bold text-[#2C2C2C]">Date</th>
              <th className="px-4 py-3 font-bold text-[#2C2C2C]">Status</th>
              <th className="px-4 py-3 text-right font-bold text-[#2C2C2C]">Actions</th>
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
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={deletingLeadId === l.id}
                    onClick={() => void onDeleteLead(l.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                  >
                    {deletingLeadId === l.id ? "Deleting…" : "Delete"}
                  </button>
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
  ownedListingCount,
  listingOpen,
  setListingOpen,
  listingForm,
  setListingForm,
  onSubmit,
  saving,
  listingLimit,
  onOpenNewListing,
  onDeleteProperty,
  deletingPropertyId,
}: {
  properties: PropertyRow[];
  ownedListingCount: number;
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
  onDeleteProperty: (id: string) => void | Promise<void>;
  deletingPropertyId: string | null;
}) {
  const cohostCount = properties.filter((p) => p.isCoHost).length;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Listings</h1>
          <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
            Owned slots {ownedListingCount}/{listingLimit}
            {cohostCount > 0 ? ` · Co-hosting ${cohostCount}` : ""}.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenNewListing}
          className="rounded-full bg-[#D4A843] px-5 py-2.5 text-sm font-bold text-[#2C2C2C] shadow-sm hover:brightness-95"
        >
          Add New Listing
        </button>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((p) => (
          <div
            key={p.id}
            className="relative overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm transition hover:shadow-md"
          >
            <Link href={`/properties/${encodeURIComponent(p.id)}`} className="block">
              <div className="relative h-40 w-full bg-black/5">
                <Image src={p.image_url} alt="" fill className="object-cover" sizes="400px" />
                <span className="absolute left-2 top-2 rounded-full bg-[#6B9E6E] px-2 py-1 text-[10px] font-bold text-white">
                  {p.status === "for_rent" ? "For Rent" : "For Sale"}
                </span>
                {p.isCoHost ? (
                  <span className="absolute bottom-2 left-2 rounded-full bg-[#D4A843] px-2 py-1 text-[10px] font-bold text-[#2C2C2C] shadow-sm">
                    Co-Host
                  </span>
                ) : null}
              </div>
              <div className="p-4">
                <p className="font-semibold text-[#2C2C2C]">{p.location}</p>
                <p className="mt-1 font-serif text-lg font-bold text-[#2C2C2C]">
                  {formatListingPricePhp(p.price, p.status)}
                </p>
              </div>
            </Link>
            {!p.isCoHost ? (
              <button
                type="button"
                disabled={deletingPropertyId === p.id}
                onClick={(e) => {
                  e.preventDefault();
                  void onDeleteProperty(p.id);
                }}
                className="absolute right-2 top-2 z-10 rounded-full border border-red-200 bg-white/95 px-3 py-1.5 text-xs font-bold text-red-800 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingPropertyId === p.id ? "Deleting…" : "Delete"}
              </button>
            ) : null}
          </div>
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
                className="mt-6 w-full rounded-full bg-[#2C2C2C] py-3 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:opacity-50"
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
  supabase,
  userId,
  onAvailabilitySaved,
  onAvailabilityMessage,
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
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  userId: string;
  onAvailabilitySaved: () => void | Promise<void>;
  onAvailabilityMessage: (msg: string) => void;
}) {
  const [availSaving, setAvailSaving] = useState(false);
  const showAvailableNow = agent.availability?.trim() === AGENT_AVAILABILITY_NOW;

  const setAvailableNow = async (on: boolean) => {
    setAvailSaving(true);
    onAvailabilityMessage("");
    const { error } = await supabase
      .from("agents")
      .update({ availability: on ? AGENT_AVAILABILITY_NOW : AGENT_AVAILABILITY_OFFLINE })
      .eq("user_id", userId);
    setAvailSaving(false);
    if (error) {
      onAvailabilityMessage(error.message);
      return;
    }
    onAvailabilityMessage(on ? "You’re shown as Available Now on listings." : "You’re shown as Offline. Last seen was updated.");
    await onAvailabilitySaved();
  };

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">Profile settings</h1>
      <form onSubmit={onSave} className="mt-8 max-w-xl space-y-5 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Photo</p>
          <div className="mt-2 flex items-center gap-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-full bg-[#EBE6DC] ring-2 ring-[#D4A843]/30">
              {agent.image_url ? <Image src={agent.image_url} alt="" fill className="object-cover" sizes="80px" /> : null}
            </div>
            <label className="cursor-pointer rounded-full border border-[#6B9E6E] bg-[#6B9E6E]/10 px-4 py-2 text-sm font-semibold text-[#2C2C2C] hover:bg-[#6B9E6E]/20">
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
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-4 py-3">
          <div>
            <p className="text-sm font-bold text-[#2C2C2C]">Show as Available Now</p>
            <p className="mt-0.5 text-xs font-semibold text-[#2C2C2C]/55">
              When off, buyers see you as Offline with last seen time.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showAvailableNow}
            disabled={availSaving}
            onClick={() => void setAvailableNow(!showAvailableNow)}
            className={`relative h-9 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35 disabled:opacity-50 ${
              showAvailableNow ? "bg-[#6B9E6E]" : "bg-[#2C2C2C]/20"
            }`}
          >
            <span
              className={`absolute top-1 left-1 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                showAvailableNow ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
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
          className="w-full rounded-full bg-[#2C2C2C] py-3 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>

      <AgentAvailabilitySchedule
        key={JSON.stringify(agent.availability_schedule ?? {})}
        agent={agent}
        supabase={supabase}
        userId={userId}
        onSaved={onAvailabilitySaved}
      />
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
  if (type === "property_match") return <Home className="h-4 w-4 text-[#6B9E6E]" />;
  if (type === "lead_created") return <Sparkles className="h-4 w-4 text-[#D4A843]" />;
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

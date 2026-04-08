"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LicenseExpiryBadge } from "@/components/LicenseExpiryBadge";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { SettingsAvatarUpload } from "@/components/settings/avatar-upload";
import { useAuth } from "@/contexts/auth-context";
import type { ProfileRole } from "@/lib/auth-roles";
import { pathForRole } from "@/lib/auth-roles";
import { formatLicenseDate, isLicenseExpiringWithinDays } from "@/lib/license-expiry";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatPriceInputDigits, parseListingPricePesos } from "@/lib/validation/listing-form";
import { PhPhoneInput } from "@/components/ui/ph-phone-input";
import { ServiceAreasMultiInput } from "@/components/ui/service-areas-multi-input";
import { isPhilippinePhoneMode, validatePhilippinePhoneInput } from "@/lib/phone-ph";

const COUNTRY_OPTIONS = [
  "Philippines",
  "USA",
  "Canada",
  "Australia",
  "UK",
  "Singapore",
  "UAE",
  "Japan",
  "South Korea",
  "China",
  "Other",
] as const;

const VISA_OPTIONS = [
  "Tourist Visa",
  "9g Work Visa",
  "SRRV Retirement Visa",
  "ACR I-Card",
  "Permanent Resident",
  "Dual Citizen",
  "Other",
] as const;

const PREFERRED_TYPE_OPTIONS = [
  "Any",
  "House & Lot",
  "Condo",
  "Apartment",
  "Commercial",
  "Farm",
] as const;

const MOVE_IN_TIMELINE_OPTIONS = [
  "As soon as possible",
  "1-3 months",
  "3-6 months",
  "6-12 months",
  "Just browsing",
] as const;

const ROLE_OPTIONS: {
  value: Exclude<ProfileRole, "admin">;
  label: string;
  description: string;
}[] = [
  {
    value: "client",
    label: "Client",
    description: "Browse listings, save properties, and connect with agents.",
  },
  {
    value: "agent",
    label: "Agent",
    description: "List properties, manage leads, and grow your pipeline.",
  },
  {
    value: "broker",
    label: "Broker",
    description: "Oversee your team and brokerage operations.",
  },
];

type SettingsTabId = "profile" | "account" | "notifications" | "verification";

const TAB_LABEL: Record<SettingsTabId, string> = {
  profile: "Profile",
  account: "Account",
  notifications: "Notifications",
  verification: "Verification",
};

function visibleTabsForRole(role: ProfileRole): SettingsTabId[] {
  const base: SettingsTabId[] = ["profile", "account", "notifications"];
  if (role === "agent" || role === "broker") return [...base, "verification"];
  return base;
}

type BrokerRow = {
  id: string;
  company_name: string;
  name: string;
  status: string;
  verified: boolean;
  license_expiry: string | null;
  license_number: string;
  email: string;
};

type AgentRow = {
  id: string;
  name: string;
  status: string;
  verified: boolean;
  license_expiry: string | null;
  license_number: string;
  email: string;
  broker_id: string | null;
};

function SettingsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, role, loading: authLoading, refreshProfile } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState("");
  const [roleMsg, setRoleMsg] = useState("");
  const [pendingRole, setPendingRole] = useState<Exclude<ProfileRole, "admin"> | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [visaType, setVisaType] = useState("");
  const [visaExpiry, setVisaExpiry] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [preferredPropertyType, setPreferredPropertyType] = useState("");
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [locationDraft, setLocationDraft] = useState("");
  const [lookingTo, setLookingTo] = useState<"" | "buy" | "rent" | "both">("");
  const [occupantCount, setOccupantCount] = useState(1);
  const [hasPets, setHasPets] = useState(false);
  const [moveInTimeline, setMoveInTimeline] = useState("");
  const [agentNotes, setAgentNotes] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const [broker, setBroker] = useState<BrokerRow | null>(null);
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [brokerageName, setBrokerageName] = useState<string | null>(null);

  const tabParam = searchParams.get("tab");

  useEffect(() => {
    if (authLoading) return;
    void (async () => {
      if (!user?.id) {
        setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select(
          "notify_email, notify_sms, role, full_name, phone, avatar_url, bio, country_of_origin, visa_type, visa_expiry, budget_min, budget_max, preferred_property_type, preferred_locations, looking_to, occupant_count, has_pets, move_in_timeline, agent_notes",
        )
        .eq("id", user.id)
        .maybeSingle();
      const row = data as {
        notify_email?: boolean;
        notify_sms?: boolean;
        role?: string;
        full_name?: string | null;
        phone?: string | null;
        avatar_url?: string | null;
        bio?: string | null;
        country_of_origin?: string | null;
        visa_type?: string | null;
        visa_expiry?: string | null;
        budget_min?: number | null;
        budget_max?: number | null;
        preferred_property_type?: string | null;
        preferred_locations?: unknown;
        looking_to?: string | null;
        occupant_count?: number | null;
        has_pets?: boolean | null;
        move_in_timeline?: string | null;
        agent_notes?: string | null;
      } | null;
      if (typeof row?.notify_email === "boolean") setNotifyEmail(row.notify_email);
      if (typeof row?.notify_sms === "boolean") setNotifySms(row.notify_sms);
      setFullName(row?.full_name ?? "");
      setPhone(row?.phone ?? "");
      setBio(row?.bio ?? "");
      setAvatarUrl(row?.avatar_url ?? "");
      setCountryOfOrigin(row?.country_of_origin ?? "");
      setVisaType(row?.visa_type ?? "");
      setVisaExpiry(
        row?.visa_expiry && typeof row.visa_expiry === "string"
          ? row.visa_expiry.slice(0, 10)
          : "",
      );
      setBudgetMin(
        row?.budget_min != null && Number.isFinite(Number(row.budget_min))
          ? formatPriceInputDigits(String(Math.round(Number(row.budget_min))))
          : "",
      );
      setBudgetMax(
        row?.budget_max != null && Number.isFinite(Number(row.budget_max))
          ? formatPriceInputDigits(String(Math.round(Number(row.budget_max))))
          : "",
      );
      setPreferredPropertyType(row?.preferred_property_type ?? "");
      const locs = row?.preferred_locations;
      setPreferredLocations(
        Array.isArray(locs) ? locs.filter((x): x is string => typeof x === "string") : [],
      );
      setLocationDraft("");
      const lt = row?.looking_to;
      setLookingTo(lt === "buy" || lt === "rent" || lt === "both" ? lt : "");
      const oc = row?.occupant_count;
      setOccupantCount(
        oc != null && Number.isFinite(Number(oc))
          ? Math.min(20, Math.max(1, Math.round(Number(oc))))
          : 1,
      );
      setHasPets(Boolean(row?.has_pets));
      setMoveInTimeline(
        typeof row?.move_in_timeline === "string" ? row.move_in_timeline : "",
      );
      setAgentNotes(typeof row?.agent_notes === "string" ? row.agent_notes : "");
      const r = row?.role;
      if (r === "client" || r === "agent" || r === "broker") {
        setPendingRole(r);
      } else {
        setPendingRole("client");
      }

      const { data: b } = await supabase
        .from("brokers")
        .select(
          "id, company_name, name, status, verified, license_expiry, license_number, email",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: a } = await supabase
        .from("agents")
        .select("id, name, status, verified, license_expiry, license_number, email, broker_id")
        .eq("user_id", user.id)
        .maybeSingle();

      setBroker((b as BrokerRow | null) ?? null);
      setAgent((a as AgentRow | null) ?? null);

      if (a?.broker_id) {
        const { data: br } = await supabase
          .from("brokers")
          .select("company_name")
          .eq("id", a.broker_id)
          .maybeSingle();
        setBrokerageName(
          (br as { company_name?: string } | null)?.company_name ?? null,
        );
      } else {
        setBrokerageName(null);
      }

      setLoaded(true);
    })();
  }, [user?.id, authLoading, supabase]);

  useEffect(() => {
    if (!profile || profile.role === "admin") return;
    const r = profile.role;
    if (r === "client" || r === "agent" || r === "broker") {
      setPendingRole(r);
    }
  }, [profile]);

  const currentRole = profile?.role ?? "client";
  const isAdmin = currentRole === "admin";
  const visibleTabs = useMemo(() => visibleTabsForRole(currentRole), [currentRole]);

  const activeTab: SettingsTabId = useMemo(() => {
    const t = tabParam as SettingsTabId | null;
    if (t && visibleTabs.includes(t)) return t;
    return "profile";
  }, [tabParam, visibleTabs]);

  useEffect(() => {
    if (!loaded || !user) return;
    const t = tabParam as SettingsTabId | null;
    if (!t || !visibleTabs.includes(t)) {
      router.replace(`/settings?tab=${activeTab}`, { scroll: false });
    }
  }, [loaded, user, tabParam, visibleTabs, activeTab, router]);

  const goTab = useCallback(
    (id: SettingsTabId) => {
      router.replace(`/settings?tab=${id}`, { scroll: false });
    },
    [router],
  );

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const {
        data: { user: authUser },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !authUser?.id) {
        toast.error(authErr?.message ?? "You must be signed in to save your profile.");
        return;
      }
      const uid = authUser.id;

      const ph = phone.trim();
      if (ph && isPhilippinePhoneMode(ph)) {
        const phErr = validatePhilippinePhoneInput(ph);
        if (phErr) {
          toast.error(phErr);
          return;
        }
      }

      const payload: Record<string, unknown> = {
        full_name: fullName.trim() || null,
        phone: ph || null,
        bio: bio.trim() || null,
      };

      if (currentRole === "client" && !isAdmin) {
        const abroad = countryOfOrigin.trim() && countryOfOrigin.trim() !== "Philippines";
        const bmin = budgetMin.trim() ? parseListingPricePesos(budgetMin) : null;
        const bmax = budgetMax.trim() ? parseListingPricePesos(budgetMax) : null;
        if (budgetMin.trim() && bmin === null) {
          toast.error("Enter a valid minimum budget or leave it blank.");
          return;
        }
        if (budgetMax.trim() && bmax === null) {
          toast.error("Enter a valid maximum budget or leave it blank.");
          return;
        }
        if (bmin != null && bmax != null && bmin > bmax) {
          toast.error("Minimum budget cannot be greater than maximum.");
          return;
        }
        payload.country_of_origin = countryOfOrigin.trim() || null;
        payload.visa_type = abroad && visaType.trim() ? visaType.trim() : null;
        payload.visa_expiry =
          abroad && visaType.trim() && visaExpiry.trim() ? visaExpiry.trim() : null;
        payload.budget_min = bmin;
        payload.budget_max = bmax;
        payload.preferred_property_type = preferredPropertyType.trim() || null;
        payload.preferred_locations = preferredLocations;
        payload.looking_to = lookingTo || null;
        payload.occupant_count = Math.min(20, Math.max(1, Math.round(Number(occupantCount)) || 1));
        payload.has_pets = hasPets;
        payload.move_in_timeline = moveInTimeline.trim() || null;
        payload.agent_notes = agentNotes.trim() ? agentNotes.trim().slice(0, 300) : null;
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", uid)
        .select("id")
        .maybeSingle();

      if (error) {
        toast.error(error.message || "Could not save profile");
        return;
      }
      if (!data?.id) {
        toast.error("No profile row was updated. Check that your account has a profile.");
        return;
      }
      await refreshProfile();
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg("");
    if (!user?.email) {
      setPwMsg("Missing account email.");
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg("New passwords do not match.");
      return;
    }
    if (!currentPassword) {
      setPwMsg("Enter your current password.");
      return;
    }
    setSavingPw(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signErr) {
        setPwMsg("Current password is incorrect.");
        setSavingPw(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMsg("Password updated.");
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : "Could not update password");
    }
    setSavingPw(false);
  };

  const saveNotifications = async () => {
    if (!user?.id) return;
    setNotifMsg("");
    setSavingNotif(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          notify_email: notifyEmail,
          notify_sms: phone.trim() ? notifySms : false,
        })
        .eq("id", user.id);
      if (error) throw error;
      if (!phone.trim()) setNotifySms(false);
      setNotifMsg("Notification preferences saved.");
    } catch (e) {
      setNotifMsg(e instanceof Error ? e.message : "Could not save");
    }
    setSavingNotif(false);
  };

  const saveRole = async () => {
    if (!user?.id || !pendingRole || profile?.role === "admin") return;
    setRoleMsg("");
    setRoleSaving(true);
    try {
      const res = await fetch("/api/profile/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: pendingRole }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok) {
        setRoleMsg(json?.error?.message ?? "Could not update role");
        setRoleSaving(false);
        return;
      }
      setRoleMsg("Account type updated.");
      await refreshProfile();
    } catch (e) {
      setRoleMsg(e instanceof Error ? e.message : "Could not update role");
    }
    setRoleSaving(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const showExpiryWarn = (exp: string | null | undefined) =>
    isLicenseExpiringWithinDays(exp, 30);

  const onAvatarUploaded = useCallback(
    async (publicUrl: string) => {
      setAvatarUrl(publicUrl);
      await refreshProfile();
    },
    [refreshProfile],
  );

  const hasPhone = Boolean(phone.trim());

  if (authLoading || !loaded) {
    return (
      <div className="min-h-screen bg-white">
        <MaddenTopNav />
        <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-[#2C2C2C]/50">
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white">
        <MaddenTopNav />
        <div className="mx-auto max-w-lg px-4 py-16">
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 shadow-sm">
            <h1 className="font-serif text-2xl font-semibold text-[#2C2C2C]">Settings</h1>
            <p className="mt-2 text-sm text-[#2C2C2C]/60">Sign in to manage settings.</p>
            <Link
              href="/auth/login?next=/settings"
              className="mt-6 inline-flex rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5d8a60]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <MaddenTopNav />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-[#2C2C2C]">Settings</h1>
            <p className="mt-1 text-sm text-[#2C2C2C]/55">
              Account profile, preferences, and notifications.
            </p>
          </div>
          {role ? (
            <Link
              href={pathForRole(role)}
              className="text-sm font-semibold text-[#6B9E6E] underline underline-offset-2 hover:text-[#5d8a60]"
            >
              Go to dashboard
            </Link>
          ) : null}
        </div>

        <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <nav
            className="flex min-w-0 gap-1 border-b border-[#2C2C2C]/10 pb-px"
            aria-label="Settings sections"
          >
            {visibleTabs.map((id) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => goTab(id)}
                  className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${
                    isActive
                      ? "border-[#6B9E6E] text-[#6B9E6E]"
                      : "border-transparent text-[#2C2C2C]/55 hover:text-[#2C2C2C]"
                  }`}
                >
                  {TAB_LABEL[id]}
                </button>
              );
            })}
          </nav>
        </div>

        {activeTab === "profile" ? (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">Profile</h2>
            <p className="mt-1 text-sm text-[#2C2C2C]/50">
              Your name, photo, and bio appear on your account across BahayGo.
            </p>
            {user?.id ? (
              <div className="mt-6">
                <SettingsAvatarUpload
                  userId={user.id}
                  fullName={fullName}
                  avatarUrl={avatarUrl.trim() || null}
                  supabase={supabase}
                  onUploaded={onAvatarUploaded}
                />
              </div>
            ) : null}
            <form onSubmit={saveProfile} className="mt-8 space-y-4">
              <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                Full name
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                />
              </label>
              <div>
                <label className="block text-xs font-semibold text-[#2C2C2C]/55" htmlFor="settings-phone">
                  Phone
                </label>
                <PhPhoneInput
                  id="settings-phone"
                  value={phone}
                  onChange={setPhone}
                  className="mt-1.5"
                />
              </div>
              <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                Bio
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="Tell buyers and agents a bit about yourself…"
                  className="mt-1.5 w-full resize-y rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                />
              </label>
              {currentRole === "client" && !isAdmin ? (
                <div className="space-y-6 border-t border-[#2C2C2C]/10 pt-6">
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-[#2C2C2C]">Property preferences</h3>
                    <p className="mt-1 text-sm text-[#2C2C2C]/50">
                      Optional — helps agents match you with the right listings.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2C2C2C]/45">
                      Personal
                    </p>
                    <label className="mt-3 block text-xs font-semibold text-[#2C2C2C]/55">
                      Country of origin
                      <select
                        value={countryOfOrigin}
                        onChange={(e) => setCountryOfOrigin(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                      >
                        <option value="">Select…</option>
                        {COUNTRY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    {countryOfOrigin && countryOfOrigin !== "Philippines" ? (
                      <div className="mt-4 space-y-4">
                        <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                          Visa type
                          <select
                            value={visaType}
                            onChange={(e) => setVisaType(e.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                          >
                            <option value="">Select…</option>
                            {VISA_OPTIONS.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </label>
                        {visaType ? (
                          <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                            Visa expiry
                            <input
                              type="date"
                              value={visaExpiry}
                              onChange={(e) => setVisaExpiry(e.target.value)}
                              className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                            />
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2C2C2C]/45">
                      Property
                    </p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                        Min budget
                        <input
                          inputMode="numeric"
                          value={budgetMin}
                          onChange={(e) => setBudgetMin(formatPriceInputDigits(e.target.value))}
                          placeholder="₱500,000"
                          className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                        />
                        <span className="mt-1 block text-[11px] font-medium text-[#2C2C2C]/45">
                          e.g. ₱500,000 for minimum budget
                        </span>
                      </label>
                      <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                        Max budget
                        <input
                          inputMode="numeric"
                          value={budgetMax}
                          onChange={(e) => setBudgetMax(formatPriceInputDigits(e.target.value))}
                          placeholder="₱15,000,000"
                          className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                        />
                        <span className="mt-1 block text-[11px] font-medium text-[#2C2C2C]/45">
                          Digits only; formatted with commas
                        </span>
                      </label>
                    </div>
                    <label className="mt-4 block text-xs font-semibold text-[#2C2C2C]/55">
                      Preferred property type
                      <select
                        value={preferredPropertyType}
                        onChange={(e) => setPreferredPropertyType(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                      >
                        <option value="">Select…</option>
                        {PREFERRED_TYPE_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-[#2C2C2C]/55">Preferred locations</p>
                      <div className="mt-1.5">
                        <ServiceAreasMultiInput
                          values={preferredLocations}
                          onChange={setPreferredLocations}
                          draft={locationDraft}
                          onDraftChange={setLocationDraft}
                          id="settings-pref-locations"
                        />
                      </div>
                    </div>
                    <fieldset className="mt-4">
                      <legend className="text-xs font-semibold text-[#2C2C2C]/55">Looking to</legend>
                      <div className="mt-2 flex flex-wrap gap-4">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#2C2C2C]/70">
                          <input
                            type="radio"
                            name="looking-to"
                            checked={lookingTo === ""}
                            onChange={() => setLookingTo("")}
                            className="h-4 w-4 border-[#2C2C2C]/20 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                          />
                          Not specified
                        </label>
                        {(
                          [
                            { v: "buy" as const, label: "Buy" },
                            { v: "rent" as const, label: "Rent" },
                            { v: "both" as const, label: "Both" },
                          ] as const
                        ).map(({ v, label }) => (
                          <label key={v} className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#2C2C2C]">
                            <input
                              type="radio"
                              name="looking-to"
                              checked={lookingTo === v}
                              onChange={() => setLookingTo(v)}
                              className="h-4 w-4 border-[#2C2C2C]/20 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="mt-6 space-y-4 border-t border-[#2C2C2C]/10 pt-6">
                      <div>
                        <h4 className="font-serif text-base font-semibold text-[#2C2C2C]">
                          Household & timing
                        </h4>
                        <p className="mt-1 text-xs text-[#2C2C2C]/50">
                          Used when you request viewings so agents can prepare.
                        </p>
                      </div>
                      <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                        How many people will be living there?
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={occupantCount}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (!Number.isFinite(n)) {
                              setOccupantCount(1);
                              return;
                            }
                            setOccupantCount(Math.min(20, Math.max(1, Math.round(n))));
                          }}
                          className="mt-1.5 w-full max-w-[12rem] rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                        />
                      </label>
                      <div>
                        <p className="text-xs font-semibold text-[#2C2C2C]/55">Do you have pets?</p>
                        <div className="mt-2 flex flex-wrap gap-4">
                          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#2C2C2C]/80">
                            <input
                              type="radio"
                              name="settings-has-pets"
                              checked={!hasPets}
                              onChange={() => setHasPets(false)}
                              className="h-4 w-4 border-[#2C2C2C]/20 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                            />
                            No
                          </label>
                          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#2C2C2C]/80">
                            <input
                              type="radio"
                              name="settings-has-pets"
                              checked={hasPets}
                              onChange={() => setHasPets(true)}
                              className="h-4 w-4 border-[#2C2C2C]/20 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                            />
                            Yes
                          </label>
                        </div>
                      </div>
                      <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                        Preferred move-in timeline
                        <select
                          value={moveInTimeline}
                          onChange={(e) => setMoveInTimeline(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                        >
                          <option value="">Select…</option>
                          {MOVE_IN_TIMELINE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                        Anything agents should know?
                        <textarea
                          value={agentNotes}
                          onChange={(e) => setAgentNotes(e.target.value.slice(0, 300))}
                          rows={3}
                          maxLength={300}
                          placeholder="Parking needs, accessibility, viewing windows…"
                          className="mt-1.5 w-full resize-y rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                        />
                        <span className="mt-1 block text-[11px] font-medium text-[#2C2C2C]/40">
                          {agentNotes.length}/300
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-full bg-[#6B9E6E] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#5d8a60] disabled:opacity-50"
              >
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </form>
          </div>
        ) : null}

        {activeTab === "account" ? (
          <div className="space-y-8">
            <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
              <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">Account type</h2>
              {isAdmin ? (
                <p className="mt-4 text-sm font-semibold text-[#2C2C2C]">
                  You are signed in as <span className="text-[#6B9E6E]">Admin</span>. Role changes
                  for admin accounts are managed in the{" "}
                  <Link
                    href="/admin"
                    className="font-bold text-[#D4A843] underline underline-offset-2"
                  >
                    Admin dashboard
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-[#2C2C2C]/60">
                    Current:{" "}
                    <span className="font-semibold capitalize text-[#2C2C2C]">{currentRole}</span>
                  </p>
                  <div className="mt-5 space-y-3">
                    {ROLE_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                          pendingRole === opt.value
                            ? "border-[#6B9E6E] bg-[#6B9E6E]/8 ring-1 ring-[#6B9E6E]/25"
                            : "border-[#2C2C2C]/10 hover:border-[#6B9E6E]/35"
                        }`}
                      >
                        <input
                          type="radio"
                          name="account-type"
                          checked={pendingRole === opt.value}
                          onChange={() => setPendingRole(opt.value)}
                          className="mt-1 h-4 w-4 border-[#2C2C2C]/20 text-[#6B9E6E] focus:ring-[#6B9E6E]"
                        />
                        <span>
                          <span className="block text-sm font-bold text-[#2C2C2C]">{opt.label}</span>
                          <span className="mt-0.5 block text-xs text-[#2C2C2C]/55">
                            {opt.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {pendingRole === "agent" ? (
                    <div className="mt-4 rounded-xl border border-[#6B9E6E]/25 bg-[#6B9E6E]/8 px-4 py-3">
                      <p className="text-xs text-[#2C2C2C]/70">
                        Complete PRC verification to appear on the marketplace.
                      </p>
                      <Link
                        href="/register/agent"
                        className="mt-2 inline-flex rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#5d8a60]"
                      >
                        Complete Agent Registration
                      </Link>
                    </div>
                  ) : null}
                  {pendingRole === "broker" ? (
                    <div className="mt-4 rounded-xl border border-[#D4A843]/30 bg-[#D4A843]/10 px-4 py-3">
                      <p className="text-xs text-[#2C2C2C]/70">
                        Register your brokerage to manage agents and listings.
                      </p>
                      <Link
                        href="/register/broker"
                        className="mt-2 inline-flex rounded-full bg-[#D4A843] px-4 py-2 text-xs font-bold text-[#2C2C2C] shadow-sm hover:brightness-95"
                      >
                        Complete Broker Registration
                      </Link>
                    </div>
                  ) : null}
                  {roleMsg ? (
                    <p className="mt-4 text-sm text-[#6B9E6E]" role="status">
                      {roleMsg}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void saveRole()}
                    disabled={roleSaving || pendingRole === currentRole}
                    className="mt-4 rounded-full bg-[#6B9E6E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#5d8a60] disabled:opacity-50"
                  >
                    {roleSaving ? "Saving…" : "Save account type"}
                  </button>
                </>
              )}
            </div>

            <form
              onSubmit={savePassword}
              className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm"
            >
              <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">Change password</h2>
              <div className="mt-4 space-y-4">
                <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                  Current password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                  />
                </label>
                <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                  />
                </label>
                <label className="block text-xs font-semibold text-[#2C2C2C]/55">
                  Confirm new password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/60"
                  />
                </label>
              </div>
              {pwMsg ? <p className="mt-4 text-sm text-[#6B9E6E]">{pwMsg}</p> : null}
              <button
                type="submit"
                disabled={savingPw}
                className="mt-6 rounded-full bg-[#6B9E6E] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#5d8a60] disabled:opacity-50"
              >
                {savingPw ? "Updating…" : "Update password"}
              </button>
            </form>
          </div>
        ) : null}

        {activeTab === "notifications" ? (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
            <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">Notifications</h2>
            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#2C2C2C]/20 text-[#6B9E6E] focus:ring-[#6B9E6E]"
              />
              <span>
                <span className="text-sm font-semibold text-[#2C2C2C]">Email notifications</span>
                <span className="mt-1 block text-xs text-[#2C2C2C]/50">
                  Listing updates, saved search alerts, and account messages.
                </span>
              </span>
            </label>
            <label
              className={`mt-4 flex items-start gap-3 ${hasPhone ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
            >
              <input
                type="checkbox"
                checked={hasPhone && notifySms}
                disabled={!hasPhone}
                onChange={(e) => setNotifySms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#2C2C2C]/20 text-[#6B9E6E] focus:ring-[#6B9E6E]"
              />
              <span>
                <span className="text-sm font-semibold text-[#2C2C2C]">SMS notifications</span>
                <span className="mt-1 block text-xs text-[#2C2C2C]/50">
                  {hasPhone
                    ? "Time-sensitive alerts to your phone number on file."
                    : "Add a phone number in Profile to enable SMS."}
                </span>
              </span>
            </label>
            {notifMsg ? <p className="mt-4 text-sm text-[#6B9E6E]">{notifMsg}</p> : null}
            <button
              type="button"
              onClick={() => void saveNotifications()}
              disabled={savingNotif}
              className="mt-6 rounded-full bg-[#6B9E6E] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#5d8a60] disabled:opacity-50"
            >
              {savingNotif ? "Saving…" : "Save notification settings"}
            </button>
          </div>
        ) : null}

        {activeTab === "verification" && (currentRole === "agent" || currentRole === "broker") ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
              <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">
                License &amp; verification
              </h2>
              <p className="mt-1 text-sm text-[#2C2C2C]/50">
                Read-only details from your registration. Contact support to update your license.
              </p>
            </div>
            {broker ? (
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#2C2C2C]">Broker</h3>
                  {broker.verified && broker.status === "approved" ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                      Verified
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#FAF8F4] px-2.5 py-0.5 text-xs font-medium capitalize text-[#2C2C2C]/70">
                      {broker.status}
                    </span>
                  )}
                  <LicenseExpiryBadge licenseExpiry={broker.license_expiry} />
                </div>
                <p className="mt-2 text-sm text-[#2C2C2C]/85">{broker.company_name}</p>
                <p className="text-xs text-[#2C2C2C]/45">
                  {broker.name} · {broker.email}
                </p>
                {broker.license_number ? (
                  <p className="mt-2 text-xs font-medium text-[#2C2C2C]/70">
                    License no. {broker.license_number}
                  </p>
                ) : null}
                {broker.license_expiry ? (
                  <p className="mt-1 text-xs text-[#2C2C2C]/45">
                    License expires {formatLicenseDate(broker.license_expiry)}
                    {showExpiryWarn(broker.license_expiry) ? (
                      <span className="font-medium text-amber-800"> · renew soon</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : currentRole === "broker" ? (
              <p className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-sm text-[#2C2C2C]/60 shadow-sm">
                No broker registration found yet.{" "}
                <Link href="/register/broker" className="font-semibold text-[#6B9E6E] underline">
                  Complete broker registration
                </Link>
              </p>
            ) : null}

            {agent ? (
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#2C2C2C]">Agent</h3>
                  {agent.verified && agent.status === "approved" ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                      Verified
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#FAF8F4] px-2.5 py-0.5 text-xs font-medium capitalize text-[#2C2C2C]/70">
                      {agent.status}
                    </span>
                  )}
                  <LicenseExpiryBadge licenseExpiry={agent.license_expiry} />
                </div>
                <p className="mt-2 text-sm text-[#2C2C2C]/85">{agent.name}</p>
                <p className="text-xs text-[#2C2C2C]/45">{agent.email}</p>
                {agent.license_number ? (
                  <p className="mt-2 text-xs font-medium text-[#2C2C2C]/70">
                    License no. {agent.license_number}
                  </p>
                ) : null}
                {brokerageName ? (
                  <p className="mt-1 text-xs text-[#2C2C2C]/45">Brokerage: {brokerageName}</p>
                ) : null}
                {agent.license_expiry ? (
                  <p className="mt-2 text-xs text-[#2C2C2C]/45">
                    License expires {formatLicenseDate(agent.license_expiry)}
                    {showExpiryWarn(agent.license_expiry) ? (
                      <span className="font-medium text-amber-800"> · renew soon</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            ) : currentRole === "agent" ? (
              <p className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-sm text-[#2C2C2C]/60 shadow-sm">
                No agent registration found yet.{" "}
                <Link href="/register/agent" className="font-semibold text-[#6B9E6E] underline">
                  Complete agent registration
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-10 border-t border-[#2C2C2C]/10 pt-8">
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full rounded-2xl border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white">
          <MaddenTopNav />
          <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-[#2C2C2C]/50">
            Loading…
          </div>
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}

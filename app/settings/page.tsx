"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LicenseExpiryBadge } from "@/components/LicenseExpiryBadge";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ProfileRole } from "@/lib/auth-roles";
import { pathForRole } from "@/lib/auth-roles";
import { formatLicenseDate, isLicenseExpiringWithinDays } from "@/lib/license-expiry";

const ROLE_OPTIONS: { value: Exclude<ProfileRole, "admin">; label: string; description: string }[] =
  [
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

export default function SettingsPage() {
  const { user, profile, role, loading: authLoading, refreshProfile } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState("");
  const [roleMsg, setRoleMsg] = useState("");
  const [pendingRole, setPendingRole] = useState<Exclude<ProfileRole, "admin"> | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const [broker, setBroker] = useState<BrokerRow | null>(null);
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [brokerageName, setBrokerageName] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    void (async () => {
      if (!user?.id) {
        setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("notify_email, role, full_name, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      const row = data as {
        notify_email?: boolean;
        role?: string;
        full_name?: string | null;
        phone?: string | null;
        avatar_url?: string | null;
      } | null;
      if (typeof row?.notify_email === "boolean") setNotifyEmail(row.notify_email);
      setFullName(row?.full_name ?? "");
      setPhone(row?.phone ?? "");
      setAvatarUrl(row?.avatar_url ?? "");
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
        .select(
          "id, name, status, verified, license_expiry, license_number, email, broker_id",
        )
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
  }, [profile?.role]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setProfileMsg("");
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      setProfileMsg("Profile saved.");
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Could not save profile");
    }
    setSavingProfile(false);
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg("");
    if (newPassword.length < 6) {
      setPwMsg("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg("Passwords do not match.");
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
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
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notify_email: notifyEmail })
        .eq("id", user.id);
      if (error) throw error;
      setNotifMsg("Settings saved.");
    } catch (e) {
      setNotifMsg(e instanceof Error ? e.message : "Could not save");
    }
    setSaving(false);
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

  if (authLoading || !loaded) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <MaddenTopNav />
        <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-[#2C2C2C]/50">
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <MaddenTopNav />
        <div className="mx-auto max-w-lg px-4 py-16">
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-8 shadow-sm">
            <h1 className="font-serif text-2xl font-semibold text-[#2C2C2C]">Settings</h1>
            <p className="mt-2 text-sm text-[#2C2C2C]/60">Sign in to manage settings.</p>
            <Link
              href="/auth/login?next=/settings"
              className="mt-6 inline-flex rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentRole = profile?.role ?? "client";
  const isAdmin = currentRole === "admin";

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <MaddenTopNav />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-[#2C2C2C]">Settings</h1>
            <p className="mt-1 text-sm text-[#2C2C2C]/55">
              Account profile, preferences, and notifications.
            </p>
          </div>
          {role && (
            <Link
              href={pathForRole(role)}
              className="text-sm font-semibold text-[#6B9E6E] underline underline-offset-2 hover:text-[#5f7a62]"
            >
              Go to dashboard
            </Link>
          )}
        </div>

        <form
          onSubmit={saveProfile}
          className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-md"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#D4A843]">
            Profile
          </h2>
          <p className="mt-1 text-xs text-[#2C2C2C]/50">
            Name, phone, and avatar apply to your account across the site.
          </p>
          <div className="mt-4 space-y-4">
            <label className="block text-xs font-semibold text-[#2C2C2C]/55">
              Full name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4]/50 px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#D4A843]/60"
              />
            </label>
            <label className="block text-xs font-semibold text-[#2C2C2C]/55">
              Phone
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4]/50 px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#D4A843]/60"
              />
            </label>
            <label className="block text-xs font-semibold text-[#2C2C2C]/55">
              Avatar image URL
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4]/50 px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#D4A843]/60"
              />
            </label>
          </div>
          {profileMsg && (
            <p className="mt-4 text-sm text-[#6B9E6E]">{profileMsg}</p>
          )}
          <button
            type="submit"
            disabled={savingProfile}
            className="mt-6 rounded-full bg-[#6B9E6E] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#6f8d71] disabled:opacity-50"
          >
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </form>

        <form
          onSubmit={savePassword}
          className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-md"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#D4A843]">
            Change password
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[#2C2C2C]/55 sm:col-span-2">
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4]/50 px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#D4A843]/60"
              />
            </label>
            <label className="block text-xs font-semibold text-[#2C2C2C]/55 sm:col-span-2">
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4]/50 px-3 py-2.5 text-sm text-[#2C2C2C] outline-none focus:border-[#D4A843]/60"
              />
            </label>
          </div>
          {pwMsg && (
            <p className="mt-4 text-sm text-[#6B9E6E]">{pwMsg}</p>
          )}
          <button
            type="submit"
            disabled={savingPw}
            className="mt-6 rounded-full border border-[#2C2C2C]/15 bg-white px-6 py-2.5 text-sm font-semibold text-[#2C2C2C] hover:bg-[#FAF8F4] disabled:opacity-50"
          >
            {savingPw ? "Updating…" : "Update password"}
          </button>
        </form>

        <div className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-md">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#D4A843]">
            Account type
          </h2>
          {isAdmin ? (
            <p className="mt-4 text-sm font-semibold text-[#2C2C2C]">
              You are signed in as <span className="text-[#6B9E6E]">Admin</span>. Role changes for
              admin accounts are managed in the{" "}
              <Link href="/admin" className="font-bold text-[#D4A843] underline underline-offset-2">
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
                        ? "border-[#D4A843] bg-[#FAF8F4] ring-1 ring-[#D4A843]/30"
                        : "border-[#2C2C2C]/10 hover:border-[#6B9E6E]/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="account-type"
                      checked={pendingRole === opt.value}
                      onChange={() => setPendingRole(opt.value)}
                      className="mt-1 h-4 w-4 border-[#2C2C2C]/20 text-[#6B9E6E] focus:ring-[#D4A843]"
                    />
                    <span>
                      <span className="block text-sm font-bold text-[#2C2C2C]">{opt.label}</span>
                      <span className="mt-0.5 block text-xs text-[#2C2C2C]/55">{opt.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              {pendingRole === "agent" && (
                <div className="mt-4 rounded-xl border border-[#6B9E6E]/25 bg-[#6B9E6E]/8 px-4 py-3">
                  <p className="text-xs text-[#2C2C2C]/70">
                    Complete PRC verification to appear on the marketplace.
                  </p>
                  <Link
                    href="/register/agent"
                    className="mt-2 inline-flex rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#6b8a6d]"
                  >
                    Complete Agent Registration
                  </Link>
                </div>
              )}
              {pendingRole === "broker" && (
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
              )}
              {roleMsg && (
                <p className="mt-4 text-sm text-[#6B9E6E]" role="status">
                  {roleMsg}
                </p>
              )}
              <button
                type="button"
                onClick={() => void saveRole()}
                disabled={roleSaving || pendingRole === currentRole}
                className="mt-4 rounded-full bg-[#2C2C2C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E] disabled:opacity-50"
              >
                {roleSaving ? "Saving…" : "Save account type"}
              </button>
            </>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-md">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#D4A843]">
            Notifications
          </h2>
          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[#2C2C2C]/20 text-[#6B9E6E] focus:ring-[#D4A843]"
            />
            <span>
              <span className="text-sm font-semibold text-[#2C2C2C]">
                Email me about activity
              </span>
              <span className="mt-1 block text-xs text-[#2C2C2C]/50">
                Listing updates, saved search alerts, and account messages.
              </span>
            </span>
          </label>
          {notifMsg && <p className="mt-4 text-sm text-[#6B9E6E]">{notifMsg}</p>}
          <button
            type="button"
            onClick={() => void saveNotifications()}
            disabled={saving}
            className="mt-6 rounded-full bg-[#6B9E6E] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#6f8d71] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save notification settings"}
          </button>
        </div>

        <section className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-md">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#D4A843]">
            Saved searches
          </h2>
          <p className="mt-4 text-sm text-[#2C2C2C]/50">
            You don&apos;t have any saved searches yet. When you save a search from the marketplace,
            it will appear here.
          </p>
        </section>

        {(broker || agent) && (
          <section className="mt-8 space-y-6">
            <h2 className="font-serif text-xl font-semibold text-[#2C2C2C]">
              License &amp; verification
            </h2>
            {broker && (
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-md">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#2C2C2C]">Broker</h3>
                  {broker.verified && broker.status === "approved" ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                      Verified
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#FAF8F4] px-2.5 py-0.5 text-xs font-medium text-[#2C2C2C]/70 capitalize">
                      {broker.status}
                    </span>
                  )}
                  <LicenseExpiryBadge licenseExpiry={broker.license_expiry} />
                </div>
                <p className="mt-2 text-sm text-[#2C2C2C]/85">{broker.company_name}</p>
                <p className="text-xs text-[#2C2C2C]/45">
                  {broker.name} · {broker.email}
                </p>
                {broker.license_expiry && (
                  <p className="mt-2 text-xs text-[#2C2C2C]/45">
                    License expires {formatLicenseDate(broker.license_expiry)}
                    {showExpiryWarn(broker.license_expiry) && (
                      <span className="font-medium text-amber-800"> · renew soon</span>
                    )}
                  </p>
                )}
              </div>
            )}

            {agent && (
              <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-md">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#2C2C2C]">Agent</h3>
                  {agent.verified && agent.status === "approved" ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                      Verified
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#FAF8F4] px-2.5 py-0.5 text-xs font-medium text-[#2C2C2C]/70 capitalize">
                      {agent.status}
                    </span>
                  )}
                  <LicenseExpiryBadge licenseExpiry={agent.license_expiry} />
                </div>
                <p className="mt-2 text-sm text-[#2C2C2C]/85">{agent.name}</p>
                <p className="text-xs text-[#2C2C2C]/45">{agent.email}</p>
                {brokerageName && (
                  <p className="mt-1 text-xs text-[#2C2C2C]/45">Brokerage: {brokerageName}</p>
                )}
                {agent.license_expiry && (
                  <p className="mt-2 text-xs text-[#2C2C2C]/45">
                    License expires {formatLicenseDate(agent.license_expiry)}
                    {showExpiryWarn(agent.license_expiry) && (
                      <span className="font-medium text-amber-800"> · renew soon</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </section>
        )}

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

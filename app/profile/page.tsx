"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LicenseExpiryBadge } from "@/components/LicenseExpiryBadge";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { useAuth } from "@/contexts/auth-context";
import {
  formatLicenseDate,
  isLicenseExpiringWithinDays,
} from "@/lib/license-expiry";
import { pathForRole } from "@/lib/auth-roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

export default function ProfilePage() {
  const { user, role, loading: authLoading, refreshProfile } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loaded, setLoaded] = useState(false);
  const [broker, setBroker] = useState<BrokerRow | null>(null);
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [brokerageName, setBrokerageName] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  useEffect(() => {
    if (authLoading) return;
    void (async () => {
      if (!user?.id) {
        setLoaded(true);
        return;
      }
      const { data: row } = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (row) {
        setFullName((row as { full_name?: string | null }).full_name ?? "");
        setPhone((row as { phone?: string | null }).phone ?? "");
        setAvatarUrl((row as { avatar_url?: string | null }).avatar_url ?? "");
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
      }

      setLoaded(true);
    })();
  }, [user?.id, authLoading, supabase]);

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
            <h1 className="font-serif text-2xl font-semibold text-[#2C2C2C]">Profile</h1>
            <p className="mt-2 text-sm text-[#2C2C2C]/60">Sign in to manage your account.</p>
            <Link
              href="/auth/login?next=/profile"
              className="mt-6 inline-flex rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6B9E6E]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <MaddenTopNav />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-[#2C2C2C]">My profile</h1>
            <p className="mt-1 text-sm text-[#2C2C2C]/55">
              Manage your account and preferences.
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
            Account
          </h2>
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
            {savingProfile ? "Saving…" : "Save changes"}
          </button>
        </form>

        <form
          onSubmit={savePassword}
          className="mt-6 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-md"
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

        <section className="mt-6 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-md">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#D4A843]">
            Saved searches
          </h2>
          <p className="mt-4 text-sm text-[#2C2C2C]/50">
            You don&apos;t have any saved searches yet. When you save a search from the marketplace,
            it will appear here.
          </p>
        </section>

        {(broker || agent) && (
          <section className="mt-10 space-y-6">
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

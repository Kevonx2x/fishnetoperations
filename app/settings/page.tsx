"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ProfileRole } from "@/lib/auth-roles";

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

export default function SettingsPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [roleMsg, setRoleMsg] = useState("");
  const [pendingRole, setPendingRole] = useState<Exclude<ProfileRole, "admin"> | null>(null);

  useEffect(() => {
    if (authLoading) return;
    void (async () => {
      if (!user?.id) {
        setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("notify_email, role")
        .eq("id", user.id)
        .maybeSingle();
      const row = data as { notify_email?: boolean; role?: string } | null;
      if (typeof row?.notify_email === "boolean") setNotifyEmail(row.notify_email);
      const r = row?.role;
      if (r === "client" || r === "agent" || r === "broker") {
        setPendingRole(r);
      } else {
        setPendingRole("client");
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

  const saveNotifications = async () => {
    if (!user?.id) return;
    setMsg("");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notify_email: notifyEmail })
        .eq("id", user.id);
      if (error) throw error;
      setMsg("Settings saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save");
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
              className="mt-6 inline-flex rounded-full bg-[#2C2C2C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#7C9A7E]"
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
        <h1 className="font-serif text-3xl font-semibold text-[#2C2C2C]">Settings</h1>
        <p className="mt-1 text-sm text-[#2C2C2C]/55">Account preferences and notifications.</p>

        <div className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-md">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#C9A84C]">
            Account type
          </h2>
          {isAdmin ? (
            <p className="mt-4 text-sm font-semibold text-[#2C2C2C]">
              You are signed in as <span className="text-[#7C9A7E]">Admin</span>. Role changes for
              admin accounts are managed in the{" "}
              <Link href="/admin" className="font-bold text-[#C9A84C] underline underline-offset-2">
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
                        ? "border-[#C9A84C] bg-[#FAF8F4] ring-1 ring-[#C9A84C]/30"
                        : "border-[#2C2C2C]/10 hover:border-[#7C9A7E]/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="account-type"
                      checked={pendingRole === opt.value}
                      onChange={() => setPendingRole(opt.value)}
                      className="mt-1 h-4 w-4 border-[#2C2C2C]/20 text-[#7C9A7E] focus:ring-[#C9A84C]"
                    />
                    <span>
                      <span className="block text-sm font-bold text-[#2C2C2C]">{opt.label}</span>
                      <span className="mt-0.5 block text-xs text-[#2C2C2C]/55">{opt.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              {pendingRole === "agent" && (
                <div className="mt-4 rounded-xl border border-[#7C9A7E]/25 bg-[#7C9A7E]/8 px-4 py-3">
                  <p className="text-xs text-[#2C2C2C]/70">
                    Complete PRC verification to appear on the marketplace.
                  </p>
                  <Link
                    href="/register/agent"
                    className="mt-2 inline-flex rounded-full bg-[#7C9A7E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#6b8a6d]"
                  >
                    Complete Agent Registration
                  </Link>
                </div>
              )}
              {pendingRole === "broker" && (
                <div className="mt-4 rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-4 py-3">
                  <p className="text-xs text-[#2C2C2C]/70">
                    Register your brokerage to manage agents and listings.
                  </p>
                  <Link
                    href="/register/broker"
                    className="mt-2 inline-flex rounded-full bg-[#C9A84C] px-4 py-2 text-xs font-bold text-[#2C2C2C] shadow-sm hover:brightness-95"
                  >
                    Complete Broker Registration
                  </Link>
                </div>
              )}
              {roleMsg && (
                <p className="mt-4 text-sm text-[#7C9A7E]" role="status">
                  {roleMsg}
                </p>
              )}
              <button
                type="button"
                onClick={() => void saveRole()}
                disabled={roleSaving || pendingRole === currentRole}
                className="mt-4 rounded-full bg-[#2C2C2C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#7C9A7E] disabled:opacity-50"
              >
                {roleSaving ? "Saving…" : "Save account type"}
              </button>
            </>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-md">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#C9A84C]">
            Notifications
          </h2>
          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-[#2C2C2C]/20 text-[#7C9A7E] focus:ring-[#C9A84C]"
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
          {msg && <p className="mt-4 text-sm text-[#7C9A7E]">{msg}</p>}
          <button
            type="button"
            onClick={() => void saveNotifications()}
            disabled={saving}
            className="mt-6 rounded-full bg-[#7C9A7E] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#6f8d71] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>

        <p className="mt-8 text-center text-sm text-[#2C2C2C]/45">
          <Link href="/profile" className="font-semibold text-[#7C9A7E] underline underline-offset-2">
            Back to profile
          </Link>
        </p>
      </div>
    </div>
  );
}

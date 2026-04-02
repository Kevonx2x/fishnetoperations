"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (authLoading) return;
    void (async () => {
      if (!user?.id) {
        setLoaded(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("notify_email")
        .eq("id", user.id)
        .maybeSingle();
      const v = (data as { notify_email?: boolean } | null)?.notify_email;
      if (typeof v === "boolean") setNotifyEmail(v);
      setLoaded(true);
    })();
  }, [user?.id, authLoading, supabase]);

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

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <MaddenTopNav />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-serif text-3xl font-semibold text-[#2C2C2C]">Settings</h1>
        <p className="mt-1 text-sm text-[#2C2C2C]/55">Account preferences and notifications.</p>

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

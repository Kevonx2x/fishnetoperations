"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { LandlordDashboardShell } from "@/components/dormspaces/landlord-dashboard-shell";
import { LandlordDashboardSubpageHeader } from "@/components/dormspaces/landlord-dashboard-subpage-header";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LandlordDashboardAccount() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { refreshProfile } = useAuth();

  const [accountName, setAccountName] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/dormspaces/landlord/profile", { credentials: "include" });
      const json = (await res.json()) as {
        data?: { profile?: { full_name?: string | null; email?: string | null; phone?: string | null } };
      };
      if (res.ok && json.data?.profile) {
        setAccountName(json.data.profile.full_name?.trim() ?? "");
        setAccountEmail(json.data.profile.email?.trim() ?? "");
        setAccountPhone(json.data.profile.phone?.trim() ?? "");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountBusy(true);
    setAccountSaved(false);
    setError("");
    try {
      const res = await fetch("/api/dormspaces/landlord/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ full_name: accountName, phone: accountPhone || null }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not save account");
        return;
      }
      setAccountSaved(true);
      await refreshProfile();
    } catch {
      setError("Could not save account");
    } finally {
      setAccountBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/dormspaces");
    router.refresh();
  };

  return (
    <LandlordDashboardShell loginNext="/dormspaces/dashboard/account">
      <LandlordDashboardSubpageHeader title="Account" />
      <div className="mx-auto max-w-5xl px-4 pb-32">
        {error ? <p className="mb-4 text-sm font-medium text-red-600">{error}</p> : null}

        <div className="max-w-md">
          <form
            onSubmit={(e) => void saveAccount(e)}
            className="space-y-4 rounded-xl border border-black/[0.08] bg-white p-5 shadow-[0_4px_20px_rgba(44,44,44,0.08)]"
          >
            <label className="block text-xs font-semibold uppercase text-[#525252]">
              Name
              <input
                className="mt-1 w-full rounded-xl border border-[#2C2C2C]/12 px-3 py-2.5 text-sm font-medium"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-semibold uppercase text-[#525252]">
              Email
              <input
                className="mt-1 w-full rounded-xl border border-[#2C2C2C]/12 bg-[#F3F0EA] px-3 py-2.5 text-sm font-medium text-[#484848]"
                value={accountEmail}
                readOnly
              />
              <span className="mt-1 block text-[11px] font-medium text-[#888888]">
                Contact admin to change email.
              </span>
            </label>
            <label className="block text-xs font-semibold uppercase text-[#525252]">
              Phone
              <input
                className="mt-1 w-full rounded-xl border border-[#2C2C2C]/12 px-3 py-2.5 text-sm font-medium"
                value={accountPhone}
                onChange={(e) => setAccountPhone(e.target.value)}
              />
            </label>
            {accountSaved ? (
              <p className="text-sm font-medium text-[#6B9E6E]">Account updated.</p>
            ) : null}
            <button
              type="submit"
              disabled={accountBusy}
              className="h-10 w-full rounded-xl bg-[#6B9E6E] text-sm font-bold text-white disabled:opacity-60"
            >
              {accountBusy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="h-10 w-full rounded-xl border border-[#2C2C2C]/15 text-sm font-bold text-[#484848]"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </LandlordDashboardShell>
  );
}

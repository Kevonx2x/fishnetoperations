"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LicenseExpiryBadge } from "@/components/LicenseExpiryBadge";
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
  const { user, role, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
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
      setUserId(user.id);

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

  if (authLoading || !loaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-md mx-auto rounded-2xl border border-gray-200 bg-white p-8">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Profile</h1>
          <p className="text-sm text-gray-600 mb-6">Sign in to view verification status.</p>
          <div className="flex flex-col gap-2 text-sm">
            <Link href="/register/broker" className="text-gray-900 underline">
              Register as broker
            </Link>
            <Link href="/register/agent" className="text-gray-900 underline">
              Register as agent
            </Link>
            <Link href="/" className="text-gray-500 underline">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!broker && !agent) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-md mx-auto rounded-2xl border border-gray-200 bg-white p-8">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Profile</h1>
          <p className="text-sm text-gray-600 mb-6">
            No broker or agent registration is linked to this account yet.
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <Link href="/register/broker" className="text-gray-900 underline">
              Register as broker
            </Link>
            <Link href="/register/agent" className="text-gray-900 underline">
              Register as agent
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const showExpiryWarn = (exp: string | null | undefined) =>
    isLicenseExpiringWithinDays(exp, 30);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            <Link href="/" className="underline hover:text-gray-800">
              Home
            </Link>
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
            {role && (
              <Link href={pathForRole(role)} className="underline hover:text-gray-900">
                Dashboard
              </Link>
            )}
            <button
              type="button"
              onClick={() => void supabase.auth.signOut().then(() => { window.location.href = "/"; })}
              className="underline hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">Your verification profile</h1>

        {broker && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Broker</h2>
              {broker.verified && broker.status === "approved" ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                  Verified
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
                  {broker.status}
                </span>
              )}
              <LicenseExpiryBadge licenseExpiry={broker.license_expiry} />
            </div>
            <p className="text-sm text-gray-700">{broker.company_name}</p>
            <p className="text-xs text-gray-500">{broker.name} · {broker.email}</p>
            {broker.license_expiry && (
              <p className="text-xs text-gray-500">
                License expires {formatLicenseDate(broker.license_expiry)}
                {showExpiryWarn(broker.license_expiry) && (
                  <span className="text-amber-700 font-medium"> · renew soon</span>
                )}
              </p>
            )}
          </div>
        )}

        {agent && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Agent</h2>
              {agent.verified && agent.status === "approved" ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                  Verified
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
                  {agent.status}
                </span>
              )}
              <LicenseExpiryBadge licenseExpiry={agent.license_expiry} />
            </div>
            <p className="text-sm text-gray-700">{agent.name}</p>
            <p className="text-xs text-gray-500">{agent.email}</p>
            {brokerageName && (
              <p className="text-xs text-gray-500">Brokerage: {brokerageName}</p>
            )}
            {agent.license_expiry && (
              <p className="text-xs text-gray-500">
                License expires {formatLicenseDate(agent.license_expiry)}
                {showExpiryWarn(agent.license_expiry) && (
                  <span className="text-amber-700 font-medium"> · renew soon</span>
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import type { ProfileRole } from "@/lib/auth-roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FinnMascot } from "@/components/marketplace/mascots/finn-mascot";

type Choice = {
  key: "client" | "agent" | "broker";
  icon: string;
  title: string;
  subtitle: string;
  redirectTo: string;
};

const CHOICES: Choice[] = [
  {
    key: "client",
    icon: "🏠",
    title: "I'm looking for a property",
    subtitle: "Browse verified listings and connect with trusted agents",
    redirectTo: "/",
  },
  {
    key: "agent",
    icon: "👤",
    title: "I'm a real estate agent",
    subtitle: "Showcase your listings and manage your leads",
    redirectTo: "/register/agent",
  },
  {
    key: "broker",
    icon: "🏢",
    title: "I'm a broker or agency",
    subtitle: "Manage your team and grow your brokerage",
    redirectTo: "/register/broker",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile, loading, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<Choice["key"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const needsOnboarding =
    !loading &&
    Boolean(user) &&
    Boolean(profile) &&
    profile?.onboarding_completed === false;

  useEffect(() => {
    if (!loading && !user) {
      // Logged-out users should sign in first; middleware will then route them here if needed.
      router.replace("/auth/login?next=/onboarding");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user && profile && profile.onboarding_completed) {
      router.replace("/");
    }
  }, [loading, user, profile, router]);

  if (!loading && !user) return null;
  if (!loading && user && profile && profile.onboarding_completed) return null;

  const commitChoice = async (choice: Choice["key"], redirectTo: string) => {
    if (!user) return;
    setError("");
    setSaving(true);
    try {
      const role: ProfileRole = choice;
      const { error: upErr } = await supabase
        .from("profiles")
        .update({ role, onboarding_completed: true })
        .eq("id", user.id);
      if (upErr) throw upErr;
      await refreshProfile();
      router.replace(redirectTo);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save preference");
      setSaving(false);
    }
  };

  const skip = async () => {
    await commitChoice("client", "/");
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium tracking-wide text-gray-900 hover:opacity-80"
          >
            BahayGo
          </Link>
          <div className="flex items-center gap-3">
            <FinnMascot mood="happy" size={64} className="drop-shadow-sm" />
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-4xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex items-center justify-center">
                <FinnMascot mood="still" size={110} className="drop-shadow-sm" />
              </div>
              <h1 className="font-serif text-3xl font-medium text-gray-900 sm:text-4xl">
                Welcome to BahayGo
              </h1>
              <p className="mt-2 text-sm text-gray-600 sm:text-base">
                How will you be using the platform?
              </p>
            </div>

            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="mt-10 grid gap-4 sm:grid-cols-3"
            >
              {CHOICES.map((c) => {
                const isSelected = selected === c.key;
                return (
                  <motion.button
                    key={c.key}
                    type="button"
                    variants={item}
                    onClick={() => setSelected(c.key)}
                    className={[
                      "group text-left rounded-2xl bg-white p-6 shadow-md transition-all",
                      "hover:-translate-y-1 hover:shadow-lg",
                      "border",
                      isSelected ? "border-[#C9A84C]" : "border-black/10",
                      saving ? "opacity-80 cursor-not-allowed" : "",
                    ].join(" ")}
                    disabled={saving}
                    aria-pressed={isSelected}
                  >
                    <div className="text-[64px] leading-none">{c.icon}</div>
                    <h2 className="mt-4 font-serif text-lg font-medium text-gray-900">
                      {c.title}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">{c.subtitle}</p>
                  </motion.button>
                );
              })}
            </motion.div>

            {error && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {needsOnboarding && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <button
                  type="button"
                  disabled={!selected || saving}
                  onClick={() => {
                    const choice = CHOICES.find((c) => c.key === selected);
                    if (!choice) return;
                    void commitChoice(choice.key, choice.redirectTo);
                  }}
                  className="rounded-xl bg-[#7C9A7E] px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-[#6f8d71] disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Continue"}
                </button>
                <button
                  type="button"
                  onClick={() => void skip()}
                  disabled={saving}
                  className="text-xs text-gray-500 underline hover:text-gray-700 disabled:opacity-50"
                >
                  Skip for now
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}


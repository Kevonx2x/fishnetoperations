"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const supabase = createSupabaseBrowser();

type ApprovedBroker = { id: string; company_name: string };

export default function RegisterAgentPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountMode, setAccountMode] = useState<"signin" | "signup">("signup");
  const [sessionReady, setSessionReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  const [name, setName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [phone, setPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [bio, setBio] = useState("");
  const [brokerId, setBrokerId] = useState<string>("");
  const [brokers, setBrokers] = useState<ApprovedBroker[]>([]);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  const refreshSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setSessionReady(!!session);
    if (session?.user?.email) {
      setRegEmail((prev) => prev || session.user.email || "");
    }
  };

  useEffect(() => {
    void refreshSession();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshSession();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/v1/brokers");
      const json = (await res.json()) as { success?: boolean; data?: ApprovedBroker[] };
      if (json.success && Array.isArray(json.data)) setBrokers(json.data);
    })();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthNotice("");
    setAuthBusy(true);
    try {
      if (accountMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setAuthNotice(
            "Check your email to confirm your account, then sign in to finish registration.",
          );
          setAuthBusy(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
      await refreshSession();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed");
    }
    setAuthBusy(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSessionReady(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setSubmitError("Sign in or create an account first.");
      return;
    }
    setSubmitBusy(true);
    try {
      const res = await fetch("/api/v1/register/agent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          license_number: licenseNumber.trim(),
          license_expiry: licenseExpiry.trim() || null,
          phone: phone.trim() || null,
          email: regEmail.trim(),
          bio: bio.trim() || null,
          broker_id: brokerId || null,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Registration failed");
      }
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Registration failed");
    }
    setSubmitBusy(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <p className="text-sm text-gray-500 mb-2">
          <Link href="/" className="underline hover:text-gray-800">
            Home
          </Link>
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Agent registration</h1>
        <p className="text-sm text-gray-600 mb-8">
          Apply for a verified agent profile. Optionally join an approved brokerage.
        </p>

        {!sessionReady ? (
          <form
            onSubmit={handleAuth}
            className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4 mb-8"
          >
            <h2 className="text-sm font-semibold text-gray-900">Account</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAccountMode("signup")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  accountMode === "signup"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => setAccountMode("signin")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  accountMode === "signin"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                Sign in
              </button>
            </div>
            <label className="block text-xs font-medium text-gray-500">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
            </label>
            <label className="block text-xs font-medium text-gray-500">
              Password
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
            </label>
            {accountMode === "signup" && (
              <label className="block text-xs font-medium text-gray-500">
                Full name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
            )}
            {authNotice && (
              <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">{authNotice}</p>
            )}
            {authError && <p className="text-sm text-red-600">{authError}</p>}
            <button
              type="submit"
              disabled={authBusy}
              className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {authBusy ? "Please wait…" : accountMode === "signup" ? "Create & continue" : "Sign in"}
            </button>
          </form>
        ) : done ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-sm text-green-900">
            <p className="font-semibold mb-1">Application submitted</p>
            <p className="mb-4">
              Your agent profile is pending review. You will receive a notification when an admin has
              decided.
            </p>
            <Link href="/settings" className="underline font-medium">
              View profile status
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 mb-6">
              <span className="text-sm text-gray-700">Signed in</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-sm text-gray-600 underline"
              >
                Sign out
              </button>
            </div>
            <form
              onSubmit={handleRegister}
              className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4"
            >
              <h2 className="text-sm font-semibold text-gray-900">Agent details</h2>
              <label className="block text-xs font-medium text-gray-500">
                Full name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
              <label className="block text-xs font-medium text-gray-500">
                PRC / license number
                <input
                  required
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
              <label className="block text-xs font-medium text-gray-500">
                License expiry
                <input
                  type="date"
                  value={licenseExpiry}
                  onChange={(e) => setLicenseExpiry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
              <label className="block text-xs font-medium text-gray-500">
                Phone
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
              <label className="block text-xs font-medium text-gray-500">
                Email
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
              <label className="block text-xs font-medium text-gray-500">
                Brokerage (optional)
                <select
                  value={brokerId}
                  onChange={(e) => setBrokerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 bg-white"
                >
                  <option value="">Independent / none</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.company_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-500">
                Bio (optional)
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
              {submitError && <p className="text-sm text-red-600">{submitError}</p>}
              <button
                type="submit"
                disabled={submitBusy}
                className="w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {submitBusy ? "Submitting…" : "Submit for review"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

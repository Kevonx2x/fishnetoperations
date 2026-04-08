"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

const supabase = createSupabaseBrowser();

export default function RegisterBrokerPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountMode, setAccountMode] = useState<"signin" | "signup">("signup");
  const [sessionReady, setSessionReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [phone, setPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [bio, setBio] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
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
          options: {
            data: {
              full_name: companyName.trim() || name.trim(),
            },
          },
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
    window.location.href = "/auth/signout";
  };

  const uploadLogoIfNeeded = async (userId: string): Promise<string | null> => {
    if (!logoFile) return null;
    const safe = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from("broker-logos").upload(path, logoFile, {
      upsert: true,
      contentType: logoFile.type || undefined,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("broker-logos").getPublicUrl(path);
    return data.publicUrl;
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
      let logoUrl: string | null = null;
      if (logoFile) {
        logoUrl = await uploadLogoIfNeeded(session.user.id);
      }
      const res = await fetch("/api/v1/register/broker", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          company_name: companyName.trim(),
          license_number: licenseNumber.trim(),
          license_expiry: licenseExpiry.trim() || null,
          phone: phone.trim() || null,
          email: regEmail.trim(),
          website: website.trim() || null,
          logo_url: logoUrl,
          bio: bio.trim() || null,
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
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Broker registration</h1>
        <p className="text-sm text-gray-600 mb-8">
          Apply for a verified brokerage profile. An admin will review your license details.
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
                Primary contact / display name (optional for profile)
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
            )}
            {authNotice && (
              <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">{authNotice}</p>
            )}
            {authError && (
              <p className="text-sm text-red-600">{authError}</p>
            )}
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
              Your brokerage is pending review. You will receive a notification when an admin has
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
              <h2 className="text-sm font-semibold text-gray-900">Brokerage details</h2>
              <label className="block text-xs font-medium text-gray-500">
                Contact name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
              <label className="block text-xs font-medium text-gray-500">
                Company name
                <input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
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
                Public email
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
              <label className="block text-xs font-medium text-gray-500">
                Website (optional)
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
              <label className="block text-xs font-medium text-gray-500">
                Logo upload (optional)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                  className="mt-1 w-full text-sm text-gray-600"
                />
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

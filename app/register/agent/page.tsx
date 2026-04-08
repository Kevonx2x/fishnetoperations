"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { PhPhoneInput } from "@/components/ui/ph-phone-input";
import {
  formatPrcLicenseInput,
  validateAgentName,
  validateEmailField,
  validateLicenseExpiry,
  validateLicenseField,
  validatePasswordField,
  validatePhoneField,
} from "@/lib/validation/agent-registration";

const supabase = createSupabaseBrowser();

type ApprovedBroker = { id: string; company_name: string };

type FieldErrors = Partial<
  Record<
    | "name"
    | "email"
    | "password"
    | "licenseNumber"
    | "licenseExpiry"
    | "phone"
    | "regEmail"
    | "form",
    string
  >
>;

export default function RegisterAgentPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountMode, setAccountMode] = useState<"signin" | "signup">("signup");
  const [sessionReady, setSessionReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authFieldErrors, setAuthFieldErrors] = useState<FieldErrors>({});

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
  const [detailErrors, setDetailErrors] = useState<FieldErrors>({});
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

  const validateAuthForm = (): boolean => {
    const e: FieldErrors = {};
    if (accountMode === "signup") {
      const ne = validateAgentName(name);
      if (ne) e.name = ne;
    }
    const ee = validateEmailField(email);
    if (ee) e.email = ee;
    const pe = validatePasswordField(password);
    if (pe) e.password = pe;
    setAuthFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAuth = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setAuthError("");
    setAuthNotice("");
    if (!validateAuthForm()) return;
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
    window.location.href = "/";
  };

  const validateDetailForm = (): boolean => {
    const e: FieldErrors = {};
    const n = validateAgentName(name);
    if (n) e.name = n;
    const lic = validateLicenseField(licenseNumber);
    if (lic) e.licenseNumber = lic;
    const exp = validateLicenseExpiry(licenseExpiry);
    if (exp) e.licenseExpiry = exp;
    const ph = validatePhoneField(phone);
    if (ph) e.phone = ph;
    const em = validateEmailField(regEmail);
    if (em) e.regEmail = em;
    setDetailErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitError("");
    setDetailErrors({});
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      setSubmitError("Sign in or create an account first.");
      return;
    }
    if (!validateDetailForm()) return;
    setSubmitBusy(true);
    try {
      const res = await fetch("/api/v1/register/agent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          license_number: licenseNumber.trim(),
          license_expiry: licenseExpiry.trim(),
          phone: phone.trim(),
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
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <p className="mb-2 text-sm text-gray-500">
          <Link href="/" className="underline hover:text-gray-800">
            Home
          </Link>
        </p>
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Agent registration</h1>
        <p className="mb-8 text-sm text-gray-600">
          Apply for a verified agent profile. Optionally join an approved brokerage.
        </p>

        {!sessionReady ? (
          <form
            onSubmit={handleAuth}
            className="mb-8 space-y-4 rounded-2xl border border-gray-200 bg-white p-6"
          >
            <h2 className="text-sm font-semibold text-gray-900">Account</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAccountMode("signup")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  accountMode === "signup" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => setAccountMode("signin")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  accountMode === "signin" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                Sign in
              </button>
            </div>
            {accountMode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Full name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Juan Dela Cruz"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
                </label>
                {authFieldErrors.name ? <p className="mt-1 text-sm text-red-600">{authFieldErrors.name}</p> : null}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
              {authFieldErrors.email ? <p className="mt-1 text-sm text-red-600">{authFieldErrors.email}</p> : null}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>
              {authFieldErrors.password ? (
                <p className="mt-1 text-sm text-red-600">{authFieldErrors.password}</p>
              ) : null}
            </div>
            {authNotice && (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">{authNotice}</p>
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
            <p className="mb-1 font-semibold">Application submitted</p>
            <p className="mb-4">
              Your agent profile is pending review. You will receive a notification when an admin has decided.
            </p>
            <Link href="/settings" className="font-medium underline">
              View profile status
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <span className="text-sm text-gray-700">Signed in</span>
              <button type="button" onClick={() => void signOut()} className="text-sm text-gray-600 underline">
                Sign out
              </button>
            </div>
            <form onSubmit={handleRegister} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-sm font-semibold text-gray-900">Agent details</h2>
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Full name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </label>
                {detailErrors.name ? <p className="mt-1 text-sm text-red-600">{detailErrors.name}</p> : null}
              </div>
              <div className="relative z-10">
                <label htmlFor="agent-reg-license" className="block text-xs font-medium text-gray-500">
                  PRC / license number
                </label>
                <input
                  id="agent-reg-license"
                  name="license_number"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(formatPrcLicenseInput(e.target.value))}
                  placeholder="PRC-AG-2024-12345"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-400/30"
                />
                {detailErrors.licenseNumber ? (
                  <p className="mt-1 text-sm text-red-600">{detailErrors.licenseNumber}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  License expiry
                  <input
                    type="date"
                    value={licenseExpiry}
                    onChange={(e) => setLicenseExpiry(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </label>
                {detailErrors.licenseExpiry ? (
                  <p className="mt-1 text-sm text-red-600">{detailErrors.licenseExpiry}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500" htmlFor="agent-reg-phone">
                  Phone
                </label>
                <PhPhoneInput
                  id="agent-reg-phone"
                  value={phone}
                  onChange={setPhone}
                  className="mt-1"
                />
                {detailErrors.phone ? <p className="mt-1 text-sm text-red-600">{detailErrors.phone}</p> : null}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">
                  Email
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </label>
                {detailErrors.regEmail ? <p className="mt-1 text-sm text-red-600">{detailErrors.regEmail}</p> : null}
              </div>
              <label className="block text-xs font-medium text-gray-500">
                Brokerage (optional)
                <select
                  value={brokerId}
                  onChange={(e) => setBrokerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
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

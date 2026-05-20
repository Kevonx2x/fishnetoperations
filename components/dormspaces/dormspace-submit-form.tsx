"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import { GooglePlacesInput, type GooglePlaceSelectedPayload } from "@/components/forms/google-places-input";
import { useAuth } from "@/contexts/auth-context";
import type { ProfileRole } from "@/lib/auth-roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DORMSPACE_AMENITIES,
  DORMSPACE_GENDER_OPTIONS,
  DORMSPACE_ROOM_TYPE_OPTIONS,
} from "@/lib/dormspaces";

const FIELD =
  "mt-1 w-full rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#888888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

const STAFF_ROLES: ProfileRole[] = ["admin", "ops_admin", "broker", "agent", "team_member"];

function splitFullName(full: string | null | undefined): { first: string; last: string } {
  const t = full?.trim() ?? "";
  if (!t) return { first: "", last: "" };
  const space = t.indexOf(" ");
  if (space === -1) return { first: t, last: "" };
  return { first: t.slice(0, space), last: t.slice(space + 1).trim() };
}

function buildFullName(first: string, last: string): string {
  return `${first.trim()} ${last.trim()}`.trim();
}

function roleDisplayLabel(role: ProfileRole): string {
  switch (role) {
    case "ops_admin":
      return "operations admin";
    case "team_member":
      return "team member";
    case "broker":
      return "broker";
    default:
      return role;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#DDDDDD] bg-white p-5 shadow-sm md:p-6">
      <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function FileDrop({
  label,
  name,
  accept,
  file,
  onFile,
  required,
}: {
  label: string;
  name: string;
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
      {label}
      {required ? " *" : ""}
      <div className="mt-2 flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#2C2C2C]/15 bg-[#FAF8F4] px-4 py-6 text-center transition hover:border-[#6B9E6E]/40">
        <Upload className="mb-2 size-8 text-[#6B9E6E]/70" aria-hidden />
        <span className="text-sm font-medium text-[#484848]">
          {file ? file.name : "Drag & drop or click to upload"}
        </span>
        <input
          type="file"
          name={name}
          accept={accept}
          className="sr-only"
          required={required && !file}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </label>
  );
}

export function DormspaceSubmitForm() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile, refreshProfile } = useAuth();

  const isLandlordSignedIn = Boolean(user && profile?.role === "landlord");
  const isStaffSignedIn = Boolean(
    user && profile?.role && STAFF_ROLES.includes(profile.role as ProfileRole),
  );
  const showPersonalInfo = !isLandlordSignedIn;
  const showAccountSection = !user;
  const needsPasswordOnSubmit = showAccountSection;

  const profileNameParts = useMemo(() => splitFullName(profile?.full_name), [profile?.full_name]);
  const landlordFirstName = profileNameParts.first;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [landlordPhone, setLandlordPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [billingFile, setBillingFile] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [amenities, setAmenities] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [landlordEmail, setLandlordEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const { first, last } = splitFullName(profile.full_name);
    setFirstName(first);
    setLastName(last);
    setLandlordPhone(profile.phone?.trim() ?? "");
  }, [profile]);

  useEffect(() => {
    if (user?.email && showPersonalInfo) {
      setLandlordEmail(user.email);
    }
  }, [user?.email, showPersonalInfo]);

  const onPlace = useCallback((p: GooglePlaceSelectedPayload) => {
    setAddress(p.location);
    setCity(p.city);
    setNeighborhood(p.neighborhood ?? "");
    setLat(p.lat);
    setLng(p.lng);
  }, []);

  const toggleAmenity = (key: string) => {
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const checkEmail = useCallback(async (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailExists(null);
      return;
    }
    setCheckingEmail(true);
    try {
      const res = await fetch("/api/dormspaces/check-landlord-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = (await res.json()) as { success?: boolean; data?: { exists?: boolean } };
      setEmailExists(Boolean(json.data?.exists));
    } catch {
      setEmailExists(null);
    } finally {
      setCheckingEmail(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    let email = "";
    let phone = "";
    let fullName = "";

    if (isLandlordSignedIn && profile) {
      fullName = profile.full_name?.trim() ?? "";
      email = user?.email?.trim().toLowerCase() ?? "";
      phone = profile.phone?.trim() ?? "";
      if (!fullName || !email || !phone) {
        setError("Your profile is missing name, email, or phone. Update your account in the dashboard first.");
        return;
      }
    } else {
      const first = firstName.trim();
      const last = lastName.trim();
      if (isStaffSignedIn) {
        setError("Sign out and create a separate landlord account to submit a dormspace listing.");
        return;
      }
      if (!first || !last) {
        setError("Please enter your first and last name.");
        return;
      }
      fullName = buildFullName(first, last);
      email = landlordEmail.trim().toLowerCase();
      phone = landlordPhone.trim();
      if (!email) {
        setError("Please enter your email.");
        return;
      }
      if (!phone) {
        setError("Please enter your phone number.");
        return;
      }
      if (user?.email && email !== user.email.trim().toLowerCase()) {
        setError("Use the email on your signed-in account, or sign out to submit with a different email.");
        return;
      }
    }

    if (needsPasswordOnSubmit) {
      if (password.length < 8) {
        setError("Choose a password with at least 8 characters.");
        return;
      }
      if (emailExists) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          setError("Could not sign in. Check your password and try again.");
          return;
        }
      }
    }

    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("landlord_name", fullName);
    fd.set("landlord_email", email);
    fd.set("landlord_phone", phone);
    fd.delete("landlord_first_name");
    fd.delete("landlord_last_name");

    if (idFile) fd.set("landlord_id", idFile);
    if (billingFile) fd.set("proof_of_billing", billingFile);
    fd.delete("photos");
    for (const p of photos) fd.append("photos", p);
    if (city) fd.set("city", city);
    if (neighborhood) fd.set("neighborhood", neighborhood);
    if (lat != null) fd.set("latitude", String(lat));
    if (lng != null) fd.set("longitude", String(lng));
    fd.set("address", address);
    for (const [k, v] of Object.entries(amenities)) {
      if (v) fd.set(k, "true");
    }
    if (needsPasswordOnSubmit && password) {
      fd.set("landlord_password", password);
    }

    setBusy(true);
    try {
      const res = await fetch("/api/dormspaces/submit", { method: "POST", body: fd });
      const json = (await res.json()) as { id?: string; error?: string | { message?: string } };
      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : json.error?.message;
        setError(msg ?? "Submission failed");
        return;
      }
      if (needsPasswordOnSubmit && password && email) {
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
        if (loginErr) {
          setError("Listing saved but sign-in failed. Use Landlord login in the site footer.");
          return;
        }
      }
      await refreshProfile();

      router.replace("/dormspaces/dashboard?welcome=1");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  let sectionNum = 1;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6 pb-16">
      {isLandlordSignedIn ? (
        <div className="rounded-2xl border border-[#6B9E6E]/30 bg-[#6B9E6E]/10 px-4 py-3.5 text-sm font-medium text-[#2C2C2C]">
          Welcome back, <span className="font-bold">{landlordFirstName || "landlord"}</span>. Continuing your
          listing submission.
        </div>
      ) : null}

      {isStaffSignedIn && profile ? (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3.5 text-sm font-medium text-[#484848]">
          You&apos;re signed in as a <span className="font-bold text-[#2C2C2C]">{roleDisplayLabel(profile.role)}</span>.
          Sign out and create a separate landlord account before submitting a dormspace listing.
        </div>
      ) : null}

      {showPersonalInfo ? (
        <Section title={`${sectionNum++}. Landlord info`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
              First name *
              <input
                name="landlord_first_name"
                className={FIELD}
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
              Last name *
              <input
                name="landlord_last_name"
                className={FIELD}
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Email *
            <input
              name="landlord_email"
              type="email"
              className={FIELD}
              required
              value={landlordEmail}
              onChange={(e) => {
                setLandlordEmail(e.target.value);
                setEmailExists(null);
              }}
              onBlur={() => void checkEmail(landlordEmail)}
              autoComplete="email"
            />
            {checkingEmail ? (
              <span className="mt-1 block text-xs text-[#888888]">Checking email…</span>
            ) : null}
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Phone (PH) *
            <input
              name="landlord_phone"
              type="tel"
              className={FIELD}
              placeholder="+63 9XX XXX XXXX"
              required
              value={landlordPhone}
              onChange={(e) => setLandlordPhone(e.target.value)}
              autoComplete="tel"
            />
          </label>
        </Section>
      ) : null}

      <Section title={`${sectionNum++}. Verification`}>
        <FileDrop
          label="Valid ID"
          name="landlord_id"
          accept="image/*,application/pdf"
          file={idFile}
          onFile={setIdFile}
          required
        />
        <FileDrop
          label="Proof of billing"
          name="proof_of_billing"
          accept="image/*,application/pdf"
          file={billingFile}
          onFile={setBillingFile}
          required
        />
      </Section>

      <Section title={`${sectionNum++}. Listing details`}>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Title *
          <input name="title" className={FIELD} required placeholder="Cozy bedspace near BGC" />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Description
          <textarea name="description" className={cnFieldTextarea()} rows={4} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Monthly price (₱) *
            <input name="monthly_price" type="number" min={500} className={FIELD} required />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Deposit (months)
            <input name="deposit_months" type="number" min={0} step={0.5} defaultValue={1} className={FIELD} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Room type *
            <select name="room_type" className={FIELD} required defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              {DORMSPACE_ROOM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Gender preference
            <select name="gender_preference" className={FIELD} defaultValue="any">
              {DORMSPACE_GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#525252]">Address *</p>
          <GooglePlacesInput
            value={address}
            onChange={setAddress}
            onPlaceSelected={onPlace}
            addressMapPreview
            mapPreviewCenter={lat != null && lng != null ? { lat, lng } : null}
            mapPreviewInstanceId="dormspace-submit-map"
            className="mt-1"
            inputClassName={FIELD.replace("mt-1 ", "")}
            required
          />
        </div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Near school (optional)
          <input name="near_school" className={FIELD} placeholder="e.g. Ateneo, DLSU, UP Diliman" />
        </label>
      </Section>

      <Section title={`${sectionNum++}. Amenities`}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DORMSPACE_AMENITIES.map((a) => (
            <label key={a.key} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#2C2C2C]">
              <input
                type="checkbox"
                checked={Boolean(amenities[a.key])}
                onChange={() => toggleAmenity(a.key)}
                className="size-4 rounded border-[#2C2C2C]/20 text-[#6B9E6E]"
              />
              {a.label}
            </label>
          ))}
        </div>
      </Section>

      <Section title={`${sectionNum++}. Rules`}>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Curfew (optional)
          <input name="curfew" className={FIELD} placeholder="e.g. 10 PM weekdays" />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          House rules
          <textarea name="rules_notes" className={cnFieldTextarea()} rows={3} />
        </label>
      </Section>

      <Section title={`${sectionNum++}. Photos (3–10)`}>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Listing photos *
          <input
            type="file"
            accept="image/*"
            multiple
            className="mt-2 block w-full text-sm text-[#484848]"
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
          />
          {photos.length > 0 ? (
            <p className="mt-2 text-xs font-medium text-[#525252]">{photos.length} file(s) selected</p>
          ) : null}
        </label>
      </Section>

      {showAccountSection ? (
        <Section title={`${sectionNum++}. Save your account to manage this listing`}>
          <p className="text-sm font-medium text-[#484848]">
            {emailExists
              ? "Welcome back — sign in with your password to link this listing to your account."
              : "Create a landlord account to manage listings and inquiries from your dashboard."}
          </p>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Email
            <input type="email" className={FIELD} value={landlordEmail} readOnly tabIndex={-1} aria-hidden />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Password *
            <input
              type="password"
              name="landlord_password_display"
              autoComplete={emailExists ? "current-password" : "new-password"}
              className={FIELD}
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        </Section>
      ) : user && !isLandlordSignedIn && !isStaffSignedIn ? (
        <p className="rounded-xl border border-[#6B9E6E]/25 bg-[#6B9E6E]/10 px-4 py-3 text-sm font-medium text-[#484848]">
          Signed in as <span className="font-semibold text-[#2C2C2C]">{profile?.full_name ?? user.email}</span>.
          This listing will be linked to your account{profile?.role === "client" ? " and your role will update to landlord" : ""}.
        </p>
      ) : null}

      {error ? <p className="text-center text-sm font-medium text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-[#6B9E6E] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] disabled:opacity-60"
      >
        {busy
          ? "Submitting…"
          : emailExists && showAccountSection
            ? "Sign in & submit"
            : isLandlordSignedIn || user
              ? "Submit listing"
              : "Create account & submit"}
      </button>
    </form>
  );
}

function cnFieldTextarea() {
  return `${FIELD} resize-y min-h-[88px]`;
}

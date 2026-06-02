"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, Upload, X } from "lucide-react";

import { GooglePlacesInput, type GooglePlaceSelectedPayload } from "@/components/forms/google-places-input";
import { useAuth } from "@/contexts/auth-context";
import {
  isDormspaceSubmitBlockedRole,
  isLandlordCapable,
  pathForRole,
  type ProfileRole,
} from "@/lib/auth-roles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DormspaceLandlordVerificationBanner } from "@/components/dormspaces/dormspace-landlord-verification-banner";
import {
  defaultTotalBedsFromRoomType,
  DORMSPACE_AMENITIES,
  DORMSPACE_GENDER_OPTIONS,
  DORMSPACE_ROOM_TYPE_OPTIONS,
  type DormspaceRoomType,
} from "@/lib/dormspaces";
import {
  needsLandlordVerificationUpload,
  normalizeLandlordVerificationStatus,
} from "@/lib/landlord-verification";

const FIELD =
  "mt-1 w-full rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#888888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

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

const LISTING_PHOTO_MIN = 3;
const LISTING_PHOTO_MAX = 10;

function ListingPhotosDrop({
  photos,
  onPhotos,
}: {
  photos: File[];
  onPhotos: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const previews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos],
  );

  useEffect(() => {
    return () => {
      for (const p of previews) URL.revokeObjectURL(p.url);
    };
  }, [previews]);

  const mergeFiles = useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
      if (!incoming.length) return;
      onPhotos([...photos, ...incoming].slice(0, LISTING_PHOTO_MAX));
    },
    [onPhotos, photos],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) mergeFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files?.length) mergeFiles(e.dataTransfer.files);
  };

  const removeAt = (index: number) => {
    onPhotos(photos.filter((_, i) => i !== index));
  };

  const canAdd = photos.length < LISTING_PHOTO_MAX;
  const countOk = photos.length >= LISTING_PHOTO_MIN;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#525252]">
        Listing photos *
        <span className="ml-1.5 normal-case font-medium text-[#888888]">
          ({LISTING_PHOTO_MIN}–{LISTING_PHOTO_MAX} images)
        </span>
      </p>

      {previews.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previews.map((p, i) => (
            <li
              key={`${p.file.name}-${p.file.size}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-[#2C2C2C]/75 text-white opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={`Remove photo ${i + 1}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {canAdd ? (
        <label
          className={`mt-3 flex min-h-[148px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragOver
              ? "border-[#6B9E6E] bg-[#6B9E6E]/8 ring-4 ring-[#6B9E6E]/15"
              : "border-[#2C2C2C]/15 bg-[#FAF8F4] hover:border-[#6B9E6E]/45 hover:bg-[#6B9E6E]/5"
          }`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={onPick}
          />
          <div className="flex items-center gap-2 text-[#6B9E6E]">
            <Upload className="size-7" aria-hidden />
            <ImagePlus className="size-7" aria-hidden />
          </div>
          <span className="text-sm font-bold text-[#2C2C2C]">
            {photos.length === 0 ? "Click or drag photos here" : "Add more photos"}
          </span>
          <span className="max-w-xs text-xs font-medium text-[#888888]">
            JPG, PNG, or WebP · room, bathroom, and common areas
          </span>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#525252] shadow-sm">
            {photos.length} / {LISTING_PHOTO_MAX} added
          </span>
        </label>
      ) : (
        <p className="mt-3 rounded-xl border border-[#DDDDDD] bg-[#FAF8F4] px-4 py-3 text-center text-xs font-medium text-[#525252]">
          Maximum {LISTING_PHOTO_MAX} photos reached. Remove one to add another.
        </p>
      )}

      <p
        className={`mt-2 text-xs font-medium ${
          countOk ? "text-[#6B9E6E]" : photos.length > 0 ? "text-amber-700" : "text-[#888888]"
        }`}
      >
        {photos.length === 0
          ? `Add at least ${LISTING_PHOTO_MIN} clear photos so renters can see your space.`
          : countOk
            ? `${photos.length} photos ready — looks good.`
            : `Add ${LISTING_PHOTO_MIN - photos.length} more photo${LISTING_PHOTO_MIN - photos.length === 1 ? "" : "s"} (minimum ${LISTING_PHOTO_MIN}).`}
      </p>
    </div>
  );
}

export function DormspaceSubmitForm() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { user, profile, refreshProfile, loading: authLoading } = useAuth();

  const isLandlordSignedIn = Boolean(user && profile && isLandlordCapable(profile));
  const verificationStatus = normalizeLandlordVerificationStatus(
    isLandlordSignedIn ? profile?.landlord_verification_status : "unverified",
  );
  const showVerificationUpload = needsLandlordVerificationUpload(verificationStatus);
  const isRoleBlocked = Boolean(user && profile?.role && isDormspaceSubmitBlockedRole(profile.role));
  const showPersonalInfo = !isLandlordSignedIn && !isRoleBlocked;
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
  const [signingOut, setSigningOut] = useState(false);
  const [roomType, setRoomType] = useState<DormspaceRoomType | "">("");
  const [totalBeds, setTotalBeds] = useState(1);
  const [totalBedsTouched, setTotalBedsTouched] = useState(false);
  const landlordProfileRefreshUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!roomType || totalBedsTouched) return;
    setTotalBeds(defaultTotalBedsFromRoomType(roomType));
  }, [roomType, totalBedsTouched]);

  useEffect(() => {
    if (!user?.id || authLoading) return;
    if (!profile || !isLandlordCapable(profile)) return;
    if (landlordProfileRefreshUserIdRef.current === user.id) return;
    landlordProfileRefreshUserIdRef.current = user.id;
    void refreshProfile();
  }, [user?.id, authLoading, profile?.id, refreshProfile]);

  useEffect(() => {
    if (!profile) return;
    const { first, last } = splitFullName(profile.full_name);
    setFirstName(first);
    setLastName(last);
    setLandlordPhone(profile.phone?.trim() ?? "");
  }, [profile?.full_name, profile?.phone, profile?.id]);

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

  const handleSignOut = async () => {
    setSigningOut(true);
    setError("");
    try {
      await supabase.auth.signOut();
      router.replace("/dormspaces/welcome");
      router.refresh();
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (isRoleBlocked) {
      return;
    }

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
    }

    if (photos.length < LISTING_PHOTO_MIN) {
      setError(`Please add at least ${LISTING_PHOTO_MIN} listing photos.`);
      return;
    }
    if (photos.length > LISTING_PHOTO_MAX) {
      setError(`Maximum ${LISTING_PHOTO_MAX} listing photos.`);
      return;
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
      const json = (await res.json()) as {
        id?: string;
        error?: string | { code?: string; message?: string };
        success?: boolean;
      };
      if (!res.ok) {
        const err = json.error;
        const msg = typeof err === "string" ? err : err?.message;
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

      router.replace("/dormspaces/dashboard/listings?welcome=1");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  let sectionNum = 1;

  if (isRoleBlocked && profile) {
    const dashboardHref = pathForRole(profile.role);
    return (
      <div className="mx-auto max-w-lg pb-16">
        <div
          role="alert"
          className="rounded-2xl border border-[#DDDDDD] bg-white px-6 py-8 text-center shadow-sm md:px-8 md:py-10"
        >
          <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] md:text-3xl">
            Continue as a landlord?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm font-medium leading-relaxed text-[#484848]">
            You&apos;re signed in to your BahayGo{" "}
            <span className="font-semibold text-[#2C2C2C]">{roleDisplayLabel(profile.role)}</span> account.
            Dormspaces are managed under a separate landlord account. Sign out to continue listing your dormspace.
          </p>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="mt-6 w-full rounded-xl bg-[#6B9E6E] px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out and continue"}
          </button>
          <p className="mt-4">
            <Link
              href={dashboardHref}
              className="text-sm font-semibold text-[#6B9E6E] hover:underline"
            >
              Cancel and go back to my dashboard
            </Link>
          </p>
          {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6 pb-16">
      {isLandlordSignedIn ? (
        <div className="rounded-2xl border border-[#6B9E6E]/30 bg-[#6B9E6E]/10 px-4 py-3.5 text-sm font-medium text-[#2C2C2C]">
          Welcome back, <span className="font-bold">{landlordFirstName || "landlord"}</span>. Continuing your
          listing submission.
        </div>
      ) : null}

      {isLandlordSignedIn ? (
        <DormspaceLandlordVerificationBanner
          status={verificationStatus}
          rejectionReason={profile?.landlord_verification_rejection_reason}
          submittedAt={profile?.landlord_verification_submitted_at}
          variant="submit"
        />
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

      {showVerificationUpload ? (
        <Section title={`${sectionNum++}. Verification`}>
          <p className="text-sm font-medium text-[#484848]">
            Upload once — we verify your landlord account, not each listing.
          </p>
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
      ) : null}

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
            <select
              name="room_type"
              className={FIELD}
              required
              value={roomType}
              onChange={(e) => {
                const v = e.target.value as DormspaceRoomType | "";
                setRoomType(v);
                if (v && !totalBedsTouched) {
                  setTotalBeds(defaultTotalBedsFromRoomType(v));
                }
              }}
            >
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
            Total beds *
            <input
              name="total_beds"
              type="number"
              min={1}
              max={50}
              className={FIELD}
              required
              value={totalBeds}
              onChange={(e) => {
                setTotalBedsTouched(true);
                const n = parseInt(e.target.value, 10);
                setTotalBeds(Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 1);
              }}
            />
            <span className="mt-1 block text-[11px] font-medium text-[#888888]">
              Defaults from room type; adjust if your space has a different capacity.
            </span>
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
        <ListingPhotosDrop photos={photos} onPhotos={setPhotos} />
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
      ) : user && !isLandlordSignedIn ? (
        <p className="rounded-xl border border-[#6B9E6E]/25 bg-[#6B9E6E]/10 px-4 py-3 text-sm font-medium text-[#484848]">
          Signed in as <span className="font-semibold text-[#2C2C2C]">{profile?.full_name ?? user.email}</span>.
          This listing will be linked to your account
          {profile?.role === "client"
            ? " and you’ll be able to manage it from the landlord dashboard."
            : "."}
        </p>
      ) : null}

      {error ? <p className="text-center text-sm font-medium text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={busy || isRoleBlocked}
        className="w-full rounded-xl bg-[#6B9E6E] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] disabled:cursor-not-allowed disabled:opacity-45"
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

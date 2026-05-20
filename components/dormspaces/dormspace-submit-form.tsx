"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Check, Upload } from "lucide-react";

import { GooglePlacesInput, type GooglePlaceSelectedPayload } from "@/components/forms/google-places-input";
import {
  DORMSPACE_AMENITIES,
  DORMSPACE_GENDER_OPTIONS,
  DORMSPACE_ROOM_TYPE_OPTIONS,
} from "@/lib/dormspaces";

const FIELD =
  "mt-1 w-full rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#888888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

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
  const [success, setSuccess] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
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

    setBusy(true);
    try {
      const res = await fetch("/api/dormspaces/submit", { method: "POST", body: fd });
      const json = (await res.json()) as { error?: string | { message?: string } };
      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : json.error?.message;
        setError(msg ?? "Submission failed");
        return;
      }
      setSuccess(true);
      form.reset();
      setPhotos([]);
      setIdFile(null);
      setBillingFile(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[#6B9E6E]/30 bg-white p-8 text-center shadow-md">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#6B9E6E]/15">
          <Check className="size-7 text-[#6B9E6E]" />
        </div>
        <h2 className="mt-4 font-serif text-2xl font-bold text-[#2C2C2C]">Submission received</h2>
        <p className="mt-2 text-sm font-medium leading-relaxed text-[#484848]">
          Thanks — your listing is under review. We&apos;ll email you within 48 hours.
        </p>
        <Link
          href="/dormspaces"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white"
        >
          Back to Dormspaces
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6 pb-16">
      <Section title="1. Landlord info">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Full name *
          <input name="landlord_name" className={FIELD} required />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Email *
          <input name="landlord_email" type="email" className={FIELD} required />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Phone (PH) *
          <input name="landlord_phone" type="tel" className={FIELD} placeholder="+63 9XX XXX XXXX" required />
        </label>
      </Section>

      <Section title="2. Verification">
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

      <Section title="3. Listing details">
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

      <Section title="4. Amenities">
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

      <Section title="5. Rules">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Curfew (optional)
          <input name="curfew" className={FIELD} placeholder="e.g. 10 PM weekdays" />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          House rules
          <textarea name="rules_notes" className={cnFieldTextarea()} rows={3} />
        </label>
      </Section>

      <Section title="6. Photos (3–10)">
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

      {error ? <p className="text-center text-sm font-medium text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-[#6B9E6E] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] disabled:opacity-60"
      >
        {busy ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}

function cnFieldTextarea() {
  return `${FIELD} resize-y min-h-[88px]`;
}

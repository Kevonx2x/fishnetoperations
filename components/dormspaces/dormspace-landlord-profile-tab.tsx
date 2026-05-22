"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Loader2, Shield } from "lucide-react";

import { DormspaceLandlordVerificationBanner } from "@/components/dormspaces/dormspace-landlord-verification-banner";
import { CloudinaryUpload } from "@/components/ui/cloudinary-upload";
import { ServiceAreasMultiInput } from "@/components/ui/service-areas-multi-input";
import { normalizeLandlordVerificationStatus } from "@/lib/landlord-verification";
import {
  DORMSPACE_LANDLORD_LANGUAGE_OPTIONS,
  DORMSPACE_LANDLORD_SPECIALTY_OPTIONS,
  formatLandlordMemberSince,
  type DormspaceLandlordPreferredContact,
  type LandlordProfileTrust,
} from "@/lib/dormspace-landlord-profile";
import { cn } from "@/lib/utils";

type ProfilePayload = {
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  landlord_bio: string | null;
  landlord_languages: string[] | null;
  landlord_preferred_contact: DormspaceLandlordPreferredContact | null;
  landlord_years_renting: number | null;
  created_at: string | null;
  landlord_verification_status?: string | null;
  landlord_verification_rejection_reason?: string | null;
  landlord_cover_url?: string | null;
  landlord_specialties?: string[] | null;
  landlord_operating_areas?: string[] | null;
  landlord_facebook_url?: string | null;
  landlord_instagram_url?: string | null;
  landlord_about_properties?: string | null;
  landlord_viber?: string | null;
  landlord_show_phone?: boolean | null;
  landlord_show_whatsapp?: boolean | null;
  landlord_show_email?: boolean | null;
  landlord_show_viber?: boolean | null;
  landlord_show_facebook?: boolean | null;
  landlord_show_instagram?: boolean | null;
  email?: string | null;
};

type Props = {
  onError: (msg: string) => void;
  onSaved?: () => void;
};

function toggleMulti(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function showOnListings(value: boolean | null | undefined): boolean {
  return value !== false;
}

function PublicShowToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#484848]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[#6B9E6E]"
      />
      Show on listings publicly
    </label>
  );
}

type FormState = {
  displayName: string;
  phone: string;
  avatarUrl: string;
  coverUrl: string;
  bio: string;
  aboutProperties: string;
  languages: string[];
  specialties: string[];
  operatingAreas: string[];
  operatingAreaDraft: string;
  preferredContact: DormspaceLandlordPreferredContact | "";
  yearsRenting: string;
  facebookUrl: string;
  instagramUrl: string;
  viber: string;
  accountEmail: string;
  showPhone: boolean;
  showWhatsApp: boolean;
  showEmail: boolean;
  showViber: boolean;
  showFacebook: boolean;
  showInstagram: boolean;
};

const emptyForm = (): FormState => ({
  displayName: "",
  phone: "",
  avatarUrl: "",
  coverUrl: "",
  bio: "",
  aboutProperties: "",
  languages: [],
  specialties: [],
  operatingAreas: [],
  operatingAreaDraft: "",
  preferredContact: "",
  yearsRenting: "",
  facebookUrl: "",
  instagramUrl: "",
  viber: "",
  accountEmail: "",
  showPhone: true,
  showWhatsApp: true,
  showEmail: true,
  showViber: true,
  showFacebook: true,
  showInstagram: true,
});

function profileToForm(p: ProfilePayload): FormState {
  return {
    displayName: p.full_name?.trim() ?? "",
    phone: p.phone?.trim() ?? "",
    avatarUrl: p.avatar_url?.trim() ?? "",
    coverUrl: p.landlord_cover_url?.trim() ?? "",
    bio: p.landlord_bio?.trim() ?? "",
    aboutProperties: p.landlord_about_properties?.trim() ?? "",
    languages: p.landlord_languages ?? [],
    specialties: p.landlord_specialties ?? [],
    operatingAreas: p.landlord_operating_areas ?? [],
    operatingAreaDraft: "",
    preferredContact: (p.landlord_preferred_contact ?? "") as DormspaceLandlordPreferredContact | "",
    yearsRenting:
      p.landlord_years_renting != null && p.landlord_years_renting >= 0
        ? String(p.landlord_years_renting)
        : "",
    facebookUrl: p.landlord_facebook_url?.trim() ?? "",
    instagramUrl: p.landlord_instagram_url?.trim() ?? "",
    viber: p.landlord_viber?.trim() ?? "",
    accountEmail: p.email?.trim() ?? "",
    showPhone: showOnListings(p.landlord_show_phone),
    showWhatsApp: showOnListings(p.landlord_show_whatsapp),
    showEmail: showOnListings(p.landlord_show_email),
    showViber: showOnListings(p.landlord_show_viber),
    showFacebook: showOnListings(p.landlord_show_facebook),
    showInstagram: showOnListings(p.landlord_show_instagram),
  };
}

export function DormspaceLandlordProfileTab({ onError, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [trust, setTrust] = useState<LandlordProfileTrust>({
    verified_landlord: false,
    verification_pending: false,
    free_listings: true,
    member_since: null,
    active_listing_count: 0,
  });
  const [form, setForm] = useState(emptyForm);
  const [initial, setInitial] = useState(emptyForm);
  const [verificationStatus, setVerificationStatus] = useState(
    normalizeLandlordVerificationStatus("unverified"),
  );
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [suggestedAreas, setSuggestedAreas] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    onError("");
    try {
      const res = await fetch("/api/dormspaces/landlord/profile", { credentials: "include" });
      const json = (await res.json()) as {
        success?: boolean;
        data?: {
          profile?: ProfilePayload;
          trust?: LandlordProfileTrust;
          suggested_operating_areas?: string[];
        };
        error?: { message?: string };
      };
      if (!res.ok || !json.data?.profile) {
        onError(json.error?.message ?? "Could not load profile");
        return;
      }
      const p = json.data.profile;
      const next = profileToForm(p);
      setForm(next);
      setInitial(next);
      if (json.data.trust) setTrust(json.data.trust);
      setSuggestedAreas(json.data.suggested_operating_areas ?? []);
      setVerificationStatus(
        normalizeLandlordVerificationStatus(p.landlord_verification_status),
      );
      setRejectionReason(p.landlord_verification_rejection_reason ?? null);
    } catch {
      onError("Could not load profile");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const memberSinceLabel = useMemo(
    () => formatLandlordMemberSince(trust.member_since),
    [trust.member_since],
  );

  const mergeSuggestedAreas = () => {
    const merged = [...form.operatingAreas];
    for (const tag of suggestedAreas) {
      if (!merged.includes(tag)) merged.push(tag);
    }
    if (merged.length !== form.operatingAreas.length) {
      setForm((f) => ({ ...f, operatingAreas: merged }));
    }
  };

  const resetForm = () => setForm(initial);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    onError("");
    setSavedFlash(false);
    const years =
      form.yearsRenting.trim() === ""
        ? null
        : Math.max(0, Math.min(80, parseInt(form.yearsRenting, 10) || 0));

    try {
      const res = await fetch("/api/dormspaces/landlord/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          full_name: form.displayName.trim(),
          phone: form.phone.trim() || null,
          avatar_url: form.avatarUrl.trim() || null,
          landlord_cover_url: form.coverUrl.trim() || null,
          landlord_bio: form.bio.trim() || null,
          landlord_about_properties: form.aboutProperties.trim() || null,
          landlord_languages: form.languages,
          landlord_specialties: form.specialties,
          landlord_operating_areas: form.operatingAreas,
          landlord_preferred_contact: form.preferredContact || null,
          landlord_years_renting: years,
          landlord_facebook_url: form.facebookUrl.trim() || null,
          landlord_instagram_url: form.instagramUrl.trim() || null,
        }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        onError(json.error?.message ?? "Could not update profile");
        return;
      }
      setInitial(form);
      setSavedFlash(true);
      onSaved?.();
      void load();
    } catch {
      onError("Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-[#484848]">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading profile…
      </p>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-[#2C2C2C]">My Profile</h1>
        <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/55">
          How tenants see you on dormspace listing pages. Save when you are done editing.
        </p>
      </div>

      <DormspaceLandlordVerificationBanner
        status={verificationStatus}
        rejectionReason={rejectionReason}
        className="mb-4"
      />

      <ul className="mb-6 flex flex-wrap gap-2">
        {trust.verified_landlord ? (
          <li className="inline-flex items-center gap-1.5 rounded-full bg-[#D4A843]/15 px-3 py-1.5 text-xs font-bold text-[#8a6d32]">
            <BadgeCheck className="size-4" aria-hidden />
            Verified Landlord
          </li>
        ) : trust.verification_pending ? (
          <li className="rounded-full bg-[#2C2C2C]/8 px-3 py-1.5 text-xs font-semibold text-[#888888]">
            Pending verification
          </li>
        ) : (
          <li className="rounded-full bg-[#2C2C2C]/6 px-3 py-1.5 text-xs font-semibold text-[#888888]">
            Verified Landlord — not yet approved
          </li>
        )}
        <li className="inline-flex items-center gap-1.5 rounded-full bg-[#6B9E6E]/12 px-3 py-1.5 text-xs font-bold text-[#4a7a4d]">
          <Shield className="size-4" aria-hidden />
          Free Listings
        </li>
        {memberSinceLabel ? (
          <li className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#484848] ring-1 ring-[#2C2C2C]/10">
            Member since {memberSinceLabel}
          </li>
        ) : null}
        {trust.active_listing_count > 0 ? (
          <li className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#484848] ring-1 ring-[#2C2C2C]/10">
            {trust.active_listing_count} active listing{trust.active_listing_count === 1 ? "" : "s"}
          </li>
        ) : null}
      </ul>

      <form onSubmit={(e) => void save(e)} className="space-y-5">
        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
            Cover photo (optional)
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#2C2C2C]/45">
            A small banner tenants may see on your listings — not required.
          </p>
          <div className="mt-3 max-w-lg">
            <CloudinaryUpload
              value={form.coverUrl ? [form.coverUrl] : []}
              onUpload={(urls) => setForm((f) => ({ ...f, coverUrl: urls[0] ?? "" }))}
              maxFiles={1}
              disabled={saving}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
              Display name
            </span>
            <input
              className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/25"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              required
              maxLength={200}
            />
          </label>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Profile photo</p>
            <div className="mt-2 max-w-md">
              <CloudinaryUpload
                value={form.avatarUrl ? [form.avatarUrl] : []}
                onUpload={(urls) => setForm((f) => ({ ...f, avatarUrl: urls[0] ?? "" }))}
                maxFiles={1}
                disabled={saving}
              />
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">About you</span>
            <textarea
              className="mt-1.5 w-full resize-none rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C]/85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/25"
              rows={5}
              maxLength={500}
              placeholder="Tell tenants about yourself as a landlord…"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
            <p className="mt-1 text-right text-[11px] font-semibold text-[#2C2C2C]/45">{form.bio.length}/500</p>
          </label>

          <label className="mt-5 block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
              About my properties
            </span>
            <textarea
              className="mt-1.5 w-full resize-none rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C]/85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/25"
              rows={3}
              maxLength={300}
              placeholder="What are your spaces like in general? (optional)"
              value={form.aboutProperties}
              onChange={(e) => setForm((f) => ({ ...f, aboutProperties: e.target.value }))}
            />
            <p className="mt-1 text-right text-[11px] font-semibold text-[#2C2C2C]/45">
              {form.aboutProperties.length}/300
            </p>
          </label>
        </div>

        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
              Specialties / focus
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {DORMSPACE_LANDLORD_SPECIALTY_OPTIONS.map((spec) => {
                const on = form.specialties.includes(spec);
                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, specialties: toggleMulti(f.specialties, spec) }))}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-bold transition",
                      on
                        ? "bg-[#D4A843] text-[#2C2C2C]"
                        : "border border-[#2C2C2C]/15 bg-[#FAF8F4] text-[#2C2C2C]/75 hover:bg-white",
                    )}
                  >
                    {spec}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                Operating areas
              </span>
              {suggestedAreas.length > 0 && form.operatingAreas.length < suggestedAreas.length ? (
                <button
                  type="button"
                  onClick={mergeSuggestedAreas}
                  className="text-[11px] font-bold text-[#6B9E6E] hover:underline"
                >
                  Add from my listings
                </button>
              ) : null}
            </div>
            <div className="mt-1.5">
              <ServiceAreasMultiInput
                id="landlord-operating-areas"
                values={form.operatingAreas}
                onChange={(values) => setForm((f) => ({ ...f, operatingAreas: values }))}
                draft={form.operatingAreaDraft}
                onDraftChange={(v) => setForm((f) => ({ ...f, operatingAreaDraft: v }))}
              />
            </div>
          </div>

          <div className="mt-5">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Languages</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {DORMSPACE_LANDLORD_LANGUAGE_OPTIONS.map((lang) => {
                const on = form.languages.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, languages: toggleMulti(f.languages, lang) }))}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-bold transition",
                      on
                        ? "bg-[#6B9E6E] text-white"
                        : "border border-[#2C2C2C]/15 bg-[#FAF8F4] text-[#2C2C2C]/75 hover:bg-white",
                    )}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <p className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Contact on listings</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[#2C2C2C]/45">
            Tenants see icons on your dormspace pages. WhatsApp uses your phone number.
          </p>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Phone (PH)</span>
            <input
              className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/25"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+63 9XX XXX XXXX"
              maxLength={40}
            />
            <PublicShowToggle
              checked={form.showPhone}
              disabled={saving}
              onChange={(showPhone) => setForm((f) => ({ ...f, showPhone }))}
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
              WhatsApp (same as phone)
            </span>
            <p className="mt-0.5 text-[11px] font-semibold text-[#2C2C2C]/45">
              Uses the phone number above when tenants tap WhatsApp.
            </p>
            <PublicShowToggle
              checked={form.showWhatsApp}
              disabled={saving}
              onChange={(showWhatsApp) => setForm((f) => ({ ...f, showWhatsApp }))}
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Viber (PH)</span>
            <input
              className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/25"
              value={form.viber}
              onChange={(e) => setForm((f) => ({ ...f, viber: e.target.value }))}
              placeholder="+63 9XX XXX XXXX (optional)"
              maxLength={40}
            />
            <PublicShowToggle
              checked={form.showViber}
              disabled={saving}
              onChange={(showViber) => setForm((f) => ({ ...f, showViber }))}
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Email</span>
            <input
              className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]/70"
              value={form.accountEmail}
              readOnly
              placeholder="From your BahayGo account"
            />
            <p className="mt-1 text-[11px] font-semibold text-[#2C2C2C]/45">
              Listing inquiries also use the email on each dormspace submission.
            </p>
            <PublicShowToggle
              checked={form.showEmail}
              disabled={saving}
              onChange={(showEmail) => setForm((f) => ({ ...f, showEmail }))}
            />
          </label>

          <fieldset className="mt-5">
            <legend className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
              Preferred contact method
            </legend>
            <div className="mt-2 flex flex-wrap gap-4">
              {(
                [
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["either", "Either"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#2C2C2C]"
                >
                  <input
                    type="radio"
                    name="landlord_preferred_contact"
                    checked={form.preferredContact === value}
                    onChange={() => setForm((f) => ({ ...f, preferredContact: value }))}
                    className="accent-[#6B9E6E]"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-5 block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">
              Years renting out properties
            </span>
            <input
              type="number"
              min={0}
              max={80}
              className="mt-1.5 w-full max-w-[12rem] rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/25"
              value={form.yearsRenting}
              onChange={(e) => setForm((f) => ({ ...f, yearsRenting: e.target.value }))}
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <span className="text-xs font-bold uppercase tracking-wide text-[#2C2C2C]/45">Social links</span>
          <p className="mt-0.5 text-[11px] font-semibold text-[#2C2C2C]/45">
            Optional — shown as icons on your listing pages when enabled below.
          </p>
          <div className="mt-3 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-[#2C2C2C]/60">Facebook profile URL</span>
              <input
                value={form.facebookUrl}
                onChange={(e) => setForm((f) => ({ ...f, facebookUrl: e.target.value }))}
                placeholder="https://facebook.com/yourprofile"
                className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80 placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/25"
              />
              <PublicShowToggle
                checked={form.showFacebook}
                disabled={saving}
                onChange={(showFacebook) => setForm((f) => ({ ...f, showFacebook }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#2C2C2C]/60">Instagram profile URL</span>
              <input
                value={form.instagramUrl}
                onChange={(e) => setForm((f) => ({ ...f, instagramUrl: e.target.value }))}
                placeholder="https://instagram.com/yourhandle"
                className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/10 bg-white px-3 py-2 text-sm font-semibold text-[#2C2C2C]/80 placeholder:text-[#2C2C2C]/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/25"
              />
              <PublicShowToggle
                checked={form.showInstagram}
                disabled={saving}
                onChange={(showInstagram) => setForm((f) => ({ ...f, showInstagram }))}
              />
            </label>
          </div>
        </div>

        {savedFlash ? (
          <p className="text-sm font-medium text-[#6B9E6E]">Profile updated.</p>
        ) : null}

        <div className="flex flex-wrap gap-3 pb-4">
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-full bg-[#6B9E6E] px-6 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={resetForm}
            className="h-10 rounded-full border border-[#2C2C2C]/15 px-6 text-sm font-bold text-[#484848]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

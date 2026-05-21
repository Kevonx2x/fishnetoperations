"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Loader2, Shield } from "lucide-react";

import { CloudinaryUpload } from "@/components/ui/cloudinary-upload";
import {
  DORMSPACE_LANDLORD_LANGUAGE_OPTIONS,
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
};

type Props = {
  onError: (msg: string) => void;
  onSaved?: () => void;
};

function toggleLang(arr: string[], v: string) {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

const emptyForm = (): {
  displayName: string;
  phone: string;
  avatarUrl: string;
  bio: string;
  languages: string[];
  preferredContact: DormspaceLandlordPreferredContact | "";
  yearsRenting: string;
} => ({
  displayName: "",
  phone: "",
  avatarUrl: "",
  bio: "",
  languages: [],
  preferredContact: "",
  yearsRenting: "",
});

export function DormspaceLandlordProfileTab({ onError, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [trust, setTrust] = useState<LandlordProfileTrust>({
    verified_landlord: false,
    free_listings: true,
    member_since: null,
  });
  const [form, setForm] = useState(emptyForm);
  const [initial, setInitial] = useState(emptyForm);

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
        };
        error?: { message?: string };
      };
      if (!res.ok || !json.data?.profile) {
        onError(json.error?.message ?? "Could not load profile");
        return;
      }
      const p = json.data.profile;
      const next = {
        displayName: p.full_name?.trim() ?? "",
        phone: p.phone?.trim() ?? "",
        avatarUrl: p.avatar_url?.trim() ?? "",
        bio: p.landlord_bio?.trim() ?? "",
        languages: p.landlord_languages ?? [],
        preferredContact: (p.landlord_preferred_contact ?? "") as DormspaceLandlordPreferredContact | "",
        yearsRenting:
          p.landlord_years_renting != null && p.landlord_years_renting >= 0
            ? String(p.landlord_years_renting)
            : "",
      };
      setForm(next);
      setInitial(next);
      if (json.data.trust) setTrust(json.data.trust);
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
          landlord_bio: form.bio.trim() || null,
          landlord_languages: form.languages,
          landlord_preferred_contact: form.preferredContact || null,
          landlord_years_renting: years,
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
    <div className="max-w-2xl">
      <h1 className="mb-2 font-serif text-2xl font-bold text-[#2C2C2C]">My Profile</h1>
      <p className="mb-6 text-sm font-medium text-[#484848]">
        This is what tenants see on your listing pages.
      </p>

      <ul className="mb-6 flex flex-wrap gap-2">
        {trust.verified_landlord ? (
          <li className="inline-flex items-center gap-1.5 rounded-full bg-[#D4A843]/15 px-3 py-1.5 text-xs font-bold text-[#8a6d32]">
            <BadgeCheck className="size-4" aria-hidden />
            Verified Landlord
          </li>
        ) : (
          <li className="rounded-full bg-[#2C2C2C]/6 px-3 py-1.5 text-xs font-semibold text-[#888888]">
            Verified Landlord — pending approval
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
      </ul>

      <form onSubmit={(e) => void save(e)} className="space-y-5 rounded-2xl border border-[#DDDDDD] bg-white p-5 shadow-sm">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Display name
          <input
            className="mt-1 w-full rounded-xl border border-[#2C2C2C]/12 px-3 py-2.5 text-sm font-medium"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            required
            maxLength={200}
          />
        </label>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#525252]">Profile photo</p>
          <div className="mt-2 max-w-md">
            <CloudinaryUpload
              value={form.avatarUrl ? [form.avatarUrl] : []}
              onUpload={(urls) => setForm((f) => ({ ...f, avatarUrl: urls[0] ?? "" }))}
              maxFiles={1}
              disabled={saving}
            />
          </div>
        </div>

        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Bio
          <textarea
            className="mt-1 w-full rounded-xl border border-[#2C2C2C]/12 px-3 py-2.5 text-sm font-medium"
            rows={4}
            maxLength={500}
            placeholder="Tell tenants about yourself as a landlord..."
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          />
          <span className="mt-1 block text-right text-[11px] font-medium text-[#888888]">
            {form.bio.length}/500
          </span>
        </label>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Languages spoken
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {DORMSPACE_LANDLORD_LANGUAGE_OPTIONS.map((lang) => {
              const on = form.languages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, languages: toggleLang(f.languages, lang) }))}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-bold transition",
                    on ? "bg-[#6B9E6E] text-white" : "bg-[#FAF8F4] text-[#484848] ring-1 ring-[#2C2C2C]/12",
                  )}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Phone (PH)
          <input
            className="mt-1 w-full rounded-xl border border-[#2C2C2C]/12 px-3 py-2.5 text-sm font-medium"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+63 9XX XXX XXXX"
            maxLength={40}
          />
        </label>

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-[#525252]">
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
              <label key={value} className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#2C2C2C]">
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

        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Years renting out properties
          <input
            type="number"
            min={0}
            max={80}
            className="mt-1 w-full max-w-[12rem] rounded-xl border border-[#2C2C2C]/12 px-3 py-2.5 text-sm font-medium"
            value={form.yearsRenting}
            onChange={(e) => setForm((f) => ({ ...f, yearsRenting: e.target.value }))}
            placeholder="Optional"
          />
        </label>

        {savedFlash ? (
          <p className="text-sm font-medium text-[#6B9E6E]">Profile updated.</p>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Update profile"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={resetForm}
            className="h-10 rounded-xl border border-[#2C2C2C]/15 px-6 text-sm font-bold text-[#484848]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

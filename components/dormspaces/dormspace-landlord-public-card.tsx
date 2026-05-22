"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BadgeCheck, Mail, Phone } from "lucide-react";

import { SupabasePublicImage } from "@/components/supabase-public-image";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import { LandlordContactIconsRow } from "@/components/dormspaces/landlord-contact-icons-row";
import {
  formatLandlordMemberYear,
  preferredContactShort,
  type LandlordPublicProfile,
  type LandlordProfileTrust,
} from "@/lib/dormspace-landlord-profile";

type Props = {
  landlord: LandlordPublicProfile;
  trust: LandlordProfileTrust;
  listingId: string;
  listingTitle: string;
  isOwnListing?: boolean;
  onContact: () => void;
};

export function DormspaceLandlordPublicCard({
  landlord,
  trust,
  listingId,
  listingTitle,
  isOwnListing = false,
  onContact,
}: Props) {
  const name = landlord.full_name?.trim() || "Landlord";
  const initials = agentAvatarInitials(name);
  const memberYear = formatLandlordMemberYear(landlord.created_at);
  const languages = (landlord.landlord_languages ?? []).filter(Boolean);
  const specialties = (landlord.landlord_specialties ?? []).filter(Boolean);
  const contactPref = preferredContactShort(landlord.landlord_preferred_contact);

  const reportHref = useMemo(() => {
    const subject = encodeURIComponent(`Report dormspace listing ${listingId}`);
    const body = encodeURIComponent(
      `I would like to report listing ${listingId} (${name}).\n\nReason:\n`,
    );
    return `mailto:support@bahaygo.com?subject=${subject}&body=${body}`;
  }, [listingId, name]);

  return (
    <aside className="h-fit lg:sticky lg:top-6">
      <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6d32]">Landlord</p>

        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#FAF8F4] p-3">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-black/10">
            {landlord.avatar_url?.trim() ? (
              <SupabasePublicImage
                src={landlord.avatar_url}
                alt=""
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-[#6B9E6E] text-sm font-bold text-white">
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-base font-bold text-[#2C2C2C]">{name}</p>
            <p className="truncate text-xs font-semibold text-[#2C2C2C]/45">Dormspace host</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {trust.verified_landlord ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E]/15 px-2.5 py-1 text-[11px] font-bold text-[#4a7a4d]">
              <BadgeCheck className="size-3.5" aria-hidden />
              Verified Landlord
            </span>
          ) : trust.verification_pending ? (
            <span className="rounded-full bg-[#2C2C2C]/8 px-2.5 py-1 text-[11px] font-semibold text-[#888888]">
              Pending verification
            </span>
          ) : null}
        </div>

        {languages.length > 0 ? (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">Languages</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {languages.map((lang) => (
                <span
                  key={lang}
                  className="rounded-full bg-[#6B9E6E] px-2.5 py-1 text-[11px] font-bold text-white"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {specialties.length > 0 ? (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">Focus</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {specialties.map((spec) => (
                <span
                  key={spec}
                  className="rounded-full bg-[#D4A843]/18 px-2.5 py-1 text-[11px] font-bold text-[#8a6d32]"
                >
                  {spec}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <ul className="mt-4 space-y-1.5 text-xs font-medium text-[#484848]">
          {memberYear ? <li>Member since {memberYear}</li> : null}
          {contactPref ? (
            <li className="flex items-center gap-1.5">
              {landlord.landlord_preferred_contact === "phone" ? (
                <Phone className="size-3.5 text-[#6B9E6E]" aria-hidden />
              ) : (
                <Mail className="size-3.5 text-[#6B9E6E]" aria-hidden />
              )}
              Prefers {contactPref}
            </li>
          ) : null}
        </ul>

        {!isOwnListing ? (
          <LandlordContactIconsRow
            landlord={landlord}
            listingTitle={listingTitle}
            className="mt-5"
          />
        ) : null}

        {isOwnListing ? (
          <Link
            href="/dormspaces/dashboard?tab=listings"
            className="mt-5 flex w-full items-center justify-center rounded-full bg-[#6B9E6E] px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-[#5d8a60] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
          >
            Edit this listing
          </Link>
        ) : (
          <button
            type="button"
            onClick={onContact}
            className="mt-5 w-full rounded-full bg-[#6B9E6E] px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-[#5d8a60] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D4A843]/35"
          >
            Contact landlord
          </button>
        )}

        {!isOwnListing ? (
          <a
            href={reportHref}
            className="mt-4 block text-center text-[11px] font-semibold text-[#888888] underline-offset-2 hover:text-[#484848] hover:underline"
          >
            Report this listing
          </a>
        ) : null}
      </div>
    </aside>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Mail, Phone } from "lucide-react";

import { SupabasePublicImage } from "@/components/supabase-public-image";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import {
  formatLandlordMemberYear,
  LANDLORD_BIO_SNIPPET_LEN,
  preferredContactShort,
  type LandlordPublicProfile,
  type LandlordProfileTrust,
} from "@/lib/dormspace-landlord-profile";
import { cn } from "@/lib/utils";

type Props = {
  landlord: LandlordPublicProfile;
  trust: LandlordProfileTrust;
  listingId: string;
  isOwnListing?: boolean;
  onContact: () => void;
};

function BioSnippet({ bio }: { bio: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsMore = bio.length > LANDLORD_BIO_SNIPPET_LEN;
  const shown = expanded || !needsMore ? bio : `${bio.slice(0, LANDLORD_BIO_SNIPPET_LEN).trimEnd()}…`;

  return (
    <div className="mt-4">
      <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#484848]">{shown}</p>
      {needsMore ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-bold text-[#6B9E6E] hover:underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}

export function DormspaceLandlordPublicCard({
  landlord,
  trust,
  listingId,
  isOwnListing = false,
  onContact,
}: Props) {
  const name = landlord.full_name?.trim() || "Landlord";
  const initials = agentAvatarInitials(name);
  const memberYear = formatLandlordMemberYear(landlord.created_at);
  const languages = (landlord.landlord_languages ?? []).filter(Boolean);
  const specialties = (landlord.landlord_specialties ?? []).filter(Boolean);
  const areas = (landlord.landlord_operating_areas ?? []).filter(Boolean);
  const bio = landlord.landlord_bio?.trim();
  const aboutProps = landlord.landlord_about_properties?.trim();
  const contactPref = preferredContactShort(landlord.landlord_preferred_contact);
  const fb = landlord.landlord_facebook_url?.trim();
  const ig = landlord.landlord_instagram_url?.trim();

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
            {landlord.landlord_years_renting != null && landlord.landlord_years_renting > 0 ? (
              <p className="truncate text-xs font-semibold text-[#2C2C2C]/45">
                {landlord.landlord_years_renting}{" "}
                {landlord.landlord_years_renting === 1 ? "year" : "years"} renting
              </p>
            ) : (
              <p className="truncate text-xs font-semibold text-[#2C2C2C]/45">Dormspace host</p>
            )}
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

        {bio ? <BioSnippet bio={bio} /> : null}

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

        {areas.length > 0 ? (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">Areas</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {areas.slice(0, 6).map((area) => (
                <span
                  key={area}
                  className="rounded-full bg-[#FAF8F4] px-2.5 py-1 text-[11px] font-semibold text-[#484848] ring-1 ring-[#2C2C2C]/10"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {aboutProps ? (
          <p className="mt-4 text-xs font-medium leading-relaxed text-[#484848]">{aboutProps}</p>
        ) : null}

        <ul className="mt-4 space-y-1.5 text-xs font-medium text-[#484848]">
          {memberYear ? <li>Member since {memberYear}</li> : null}
          {trust.active_listing_count > 0 ? (
            <li>
              {trust.active_listing_count} dormspace{trust.active_listing_count === 1 ? "" : "s"} listed
            </li>
          ) : null}
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

        {fb || ig ? (
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">Social</span>
            <div className="flex gap-2">
              {fb ? (
                <a
                  href={fb}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid size-8 place-items-center rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] text-[11px] font-bold text-[#1877F2] hover:bg-white"
                  aria-label="Facebook profile"
                >
                  f
                </a>
              ) : null}
              {ig ? (
                <a
                  href={ig}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "grid size-8 place-items-center rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] text-[11px] font-bold text-[#E4405F] hover:bg-white",
                  )}
                  aria-label="Instagram profile"
                >
                  ig
                </a>
              ) : null}
            </div>
          </div>
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

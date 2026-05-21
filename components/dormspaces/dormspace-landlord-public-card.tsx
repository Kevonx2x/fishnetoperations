import { BadgeCheck, Shield } from "lucide-react";

import { SupabasePublicImage } from "@/components/supabase-public-image";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import {
  formatLandlordMemberSince,
  preferredContactLabel,
  type LandlordPublicProfile,
  type LandlordProfileTrust,
} from "@/lib/dormspace-landlord-profile";

type Props = {
  landlord: LandlordPublicProfile;
  trust: LandlordProfileTrust;
  onContact: () => void;
};

export function DormspaceLandlordPublicCard({ landlord, trust, onContact }: Props) {
  const name = landlord.full_name?.trim() || "Landlord";
  const initials = agentAvatarInitials(name);
  const memberSince = formatLandlordMemberSince(landlord.created_at);
  const languages = (landlord.landlord_languages ?? []).filter(Boolean);
  const bio = landlord.landlord_bio?.trim();

  return (
    <aside className="h-fit rounded-2xl border border-[#DDDDDD] bg-[#FAF8F4] p-5">
      <div className="flex items-start gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-[#F3F0EA] ring-2 ring-white">
          {landlord.avatar_url?.trim() ? (
            <SupabasePublicImage
              src={landlord.avatar_url}
              alt=""
              width={56}
              height={56}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-[#6B9E6E] text-lg font-bold text-white">
              {initials}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg font-bold text-[#2C2C2C]">{name}</p>
          {landlord.landlord_years_renting != null && landlord.landlord_years_renting > 0 ? (
            <p className="text-xs font-medium text-[#484848]">
              {landlord.landlord_years_renting}{" "}
              {landlord.landlord_years_renting === 1 ? "year" : "years"} renting properties
            </p>
          ) : null}
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {trust.verified_landlord ? (
          <li className="inline-flex items-center gap-1 rounded-full bg-[#D4A843]/15 px-2.5 py-1 text-[11px] font-bold text-[#8a6d32]">
            <BadgeCheck className="size-3.5" aria-hidden />
            Verified Landlord
          </li>
        ) : null}
        {trust.free_listings ? (
          <li className="inline-flex items-center gap-1 rounded-full bg-[#6B9E6E]/12 px-2.5 py-1 text-[11px] font-bold text-[#4a7a4d]">
            <Shield className="size-3.5" aria-hidden />
            Free Listings
          </li>
        ) : null}
        {memberSince ? (
          <li className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#484848] ring-1 ring-[#2C2C2C]/10">
            Member since {memberSince}
          </li>
        ) : null}
      </ul>

      {bio ? (
        <p className="mt-4 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#484848]">{bio}</p>
      ) : null}

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

      {landlord.phone?.trim() ? (
        <p className="mt-3 text-xs font-medium text-[#484848]">Phone: {landlord.phone.trim()}</p>
      ) : null}
      {landlord.landlord_preferred_contact ? (
        <p className="mt-1 text-xs font-medium text-[#888888]">
          Prefers: {preferredContactLabel(landlord.landlord_preferred_contact)}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onContact}
        className="mt-5 w-full rounded-xl bg-[#6B9E6E] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
      >
        Contact landlord
      </button>
    </aside>
  );
}

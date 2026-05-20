"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { DormspaceCard } from "@/components/dormspaces/dormspace-card";
import {
  DORMSPACE_GENDER_OPTIONS,
  DORMSPACE_ROOM_TYPE_OPTIONS,
  METRO_MANILA_CITIES,
  type DormspaceGenderPreference,
  type DormspaceRoomType,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";

const FIELD =
  "rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2 text-sm font-medium text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

export function DormspaceBrowse({ listings }: { listings: DormspaceWithPhotos[] }) {
  const [city, setCity] = useState("");
  const [roomType, setRoomType] = useState<"" | DormspaceRoomType>("");
  const [gender, setGender] = useState<"" | DormspaceGenderPreference>("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const filtered = useMemo(() => {
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;
    return listings.filter((row) => {
      const price = Number(row.monthly_price);
      if (city && (row.city?.trim() ?? "") !== city) return false;
      if (roomType && row.room_type !== roomType) return false;
      if (gender) {
        const g = row.gender_preference ?? "any";
        if (gender === "any") {
          /* no filter */
        } else if (g !== "any" && g !== gender) return false;
      }
      if (min != null && Number.isFinite(min) && price < min) return false;
      if (max != null && Number.isFinite(max) && price > max) return false;
      return true;
    });
  }, [listings, city, roomType, gender, minPrice, maxPrice]);

  return (
    <section className="mt-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] md:text-3xl">Available dormspaces</h2>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-[#DDDDDD] bg-white p-4 shadow-sm">
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#525252]">
          City
          <select className={FIELD} value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {METRO_MANILA_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Room type
          <select
            className={FIELD}
            value={roomType}
            onChange={(e) => setRoomType(e.target.value as "" | DormspaceRoomType)}
          >
            <option value="">All types</option>
            {DORMSPACE_ROOM_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[120px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Min ₱/mo
          <input className={FIELD} type="number" min={0} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
        </label>
        <label className="flex min-w-[120px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Max ₱/mo
          <input className={FIELD} type="number" min={0} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Gender
          <select
            className={FIELD}
            value={gender}
            onChange={(e) => setGender(e.target.value as "" | DormspaceGenderPreference)}
          >
            <option value="">Any</option>
            {DORMSPACE_GENDER_OPTIONS.filter((o) => o.value !== "any").map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[#2C2C2C]/15 bg-white px-6 py-14 text-center">
          <p className="font-serif text-xl font-semibold text-[#2C2C2C]">No dormspaces match your filters</p>
          <p className="mt-2 text-sm font-medium text-[#484848]">
            {listings.length === 0
              ? "Be the first to list a dormspace in Metro Manila."
              : "Try adjusting your filters or check back soon."}
          </p>
          <Link
            href="/dormspaces/submit"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
          >
            List your dormspace
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((listing) => (
            <DormspaceCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </section>
  );
}

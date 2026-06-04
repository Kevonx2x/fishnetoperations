"use client";

import { useMemo } from "react";
import {
  clampBedCountsForRoomType,
  resolveDormspaceGenderBedCounts,
  resolveDormspaceGenderBedPricing,
  syncLegacyBedFields,
  type DormspaceGenderBedCounts,
} from "@/lib/dormspace-gender-beds";
import {
  DORMSPACE_ROOM_TYPE_OPTIONS,
  defaultTotalBedsFromRoomType,
  type DormspaceRoomType,
  type DormspaceRow,
} from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

const FIELD =
  "mt-1 w-full rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

export type BedInventoryFormValue = {
  roomType: DormspaceRoomType;
  maleEnabled: boolean;
  maleTotal: number;
  malePrice: string;
  femaleEnabled: boolean;
  femaleTotal: number;
  femalePrice: string;
};

export function defaultBedInventoryForRoomType(roomType: DormspaceRoomType): BedInventoryFormValue {
  const n = defaultTotalBedsFromRoomType(roomType);
  const isPrivate = roomType === "private";
  return {
    roomType,
    maleEnabled: !isPrivate,
    maleTotal: isPrivate ? 1 : Math.max(1, Math.ceil(n / 2)),
    malePrice: "",
    femaleEnabled: false,
    femaleTotal: isPrivate ? 0 : Math.max(0, Math.floor(n / 2)),
    femalePrice: "",
  };
}

export function bedInventoryToFormFields(v: BedInventoryFormValue): Record<string, string> {
  return {
    room_type: v.roomType,
    male_enabled: v.maleEnabled ? "1" : "0",
    male_beds_total: String(v.maleTotal),
    male_monthly_price: v.malePrice,
    female_enabled: v.femaleEnabled ? "1" : "0",
    female_beds_total: String(v.femaleTotal),
    female_monthly_price: v.femalePrice,
  };
}

export function parseBedInventoryFromFormData(form: FormData): BedInventoryFormValue | null {
  const roomType = String(form.get("room_type") ?? "").trim() as DormspaceRoomType;
  if (!DORMSPACE_ROOM_TYPE_OPTIONS.some((o) => o.value === roomType)) return null;

  const maleEnabled = form.get("male_enabled") === "1" || form.get("male_enabled") === "on";
  const femaleEnabled = form.get("female_enabled") === "1" || form.get("female_enabled") === "on";
  const maleTotal = Math.max(0, parseInt(String(form.get("male_beds_total") ?? "0"), 10) || 0);
  const femaleTotal = Math.max(0, parseInt(String(form.get("female_beds_total") ?? "0"), 10) || 0);

  return {
    roomType,
    maleEnabled: maleEnabled && maleTotal > 0,
    maleTotal: maleEnabled ? maleTotal : 0,
    malePrice: String(form.get("male_monthly_price") ?? "").trim(),
    femaleEnabled: femaleEnabled && femaleTotal > 0,
    femaleTotal: femaleEnabled ? femaleTotal : 0,
    femalePrice: String(form.get("female_monthly_price") ?? "").trim(),
  };
}

export function validateBedInventory(v: BedInventoryFormValue): string | null {
  const isPrivate = v.roomType === "private";
  if (!v.maleEnabled && !v.femaleEnabled) {
    return "Enable at least male or female beds.";
  }
  if (isPrivate && v.maleEnabled && v.femaleEnabled) {
    return "Private rooms can only offer one gender.";
  }
  if (v.maleEnabled) {
    if (v.maleTotal < 1) return "Set male bed count.";
    if (isPrivate && v.maleTotal > 1) return "Private room allows 1 male bed.";
    const p = Number(v.malePrice);
    if (!Number.isFinite(p) || p < 500) return "Enter male bed price (₱500 minimum).";
  }
  if (v.femaleEnabled) {
    if (v.femaleTotal < 1) return "Set female bed count.";
    if (isPrivate && v.femaleTotal > 1) return "Private room allows 1 female bed.";
    const p = Number(v.femalePrice);
    if (!Number.isFinite(p) || p < 500) return "Enter female bed price (₱500 minimum).";
  }
  return null;
}

export function bedInventoryToDbPayload(v: BedInventoryFormValue) {
  let counts: DormspaceGenderBedCounts = {
    maleTotal: v.maleEnabled ? v.maleTotal : 0,
    maleAvailable: v.maleEnabled ? v.maleTotal : 0,
    femaleTotal: v.femaleEnabled ? v.femaleTotal : 0,
    femaleAvailable: v.femaleEnabled ? v.femaleTotal : 0,
  };
  counts = clampBedCountsForRoomType(v.roomType, counts);
  const male_monthly_price = v.maleEnabled ? Number(v.malePrice) : null;
  const female_monthly_price = v.femaleEnabled ? Number(v.femalePrice) : null;
  return { counts, male_monthly_price, female_monthly_price, room_type: v.roomType };
}

export function bedInventoryFromListing(row: DormspaceRow): BedInventoryFormValue {
  const counts = resolveDormspaceGenderBedCounts(row);
  const pricing = resolveDormspaceGenderBedPricing(row);
  return {
    roomType: row.room_type,
    maleEnabled: counts.maleTotal > 0,
    maleTotal: counts.maleTotal,
    malePrice: counts.maleTotal > 0 && pricing.malePrice != null ? String(pricing.malePrice) : "",
    femaleEnabled: counts.femaleTotal > 0,
    femaleTotal: counts.femaleTotal,
    femalePrice:
      counts.femaleTotal > 0 && pricing.femalePrice != null ? String(pricing.femalePrice) : "",
  };
}

export function buildGenderBedDbFields(
  v: BedInventoryFormValue,
  opts?: { maleAvailable?: number; femaleAvailable?: number },
): { payload: Record<string, unknown>; error: string | null } {
  const validationError = validateBedInventory(v);
  if (validationError) return { payload: {}, error: validationError };

  const { counts: rawCounts, male_monthly_price, female_monthly_price, room_type } =
    bedInventoryToDbPayload(v);

  const counts: DormspaceGenderBedCounts = {
    ...rawCounts,
    maleAvailable:
      rawCounts.maleTotal > 0
        ? Math.min(
            rawCounts.maleTotal,
            Math.max(0, opts?.maleAvailable ?? rawCounts.maleAvailable),
          )
        : 0,
    femaleAvailable:
      rawCounts.femaleTotal > 0
        ? Math.min(
            rawCounts.femaleTotal,
            Math.max(0, opts?.femaleAvailable ?? rawCounts.femaleAvailable),
          )
        : 0,
  };

  const pricing = { malePrice: male_monthly_price, femalePrice: female_monthly_price };
  const legacy = syncLegacyBedFields(counts, pricing);

  return {
    payload: {
      room_type,
      male_beds_total: counts.maleTotal,
      male_beds_available: counts.maleAvailable,
      female_beds_total: counts.femaleTotal,
      female_beds_available: counts.femaleAvailable,
      male_monthly_price,
      female_monthly_price,
      total_beds: legacy.total_beds,
      available_beds: legacy.available_beds,
      gender_preference: legacy.gender_preference,
      monthly_price: legacy.monthly_price,
    },
    error: null,
  };
}

type Props = {
  value: BedInventoryFormValue;
  onChange: (next: BedInventoryFormValue) => void;
  fieldClassName?: string;
};

export function DormspaceBedInventoryFields({ value, onChange, fieldClassName }: Props) {
  const isPrivate = value.roomType === "private";
  const field = fieldClassName ?? FIELD;

  const roomTypeSelect = (
    <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
      Room type *
      <select
        name="room_type"
        className={field}
        required
        value={value.roomType}
        onChange={(e) => {
          const rt = e.target.value as DormspaceRoomType;
          onChange({ ...defaultBedInventoryForRoomType(rt), roomType: rt });
        }}
      >
        {DORMSPACE_ROOM_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  const genderBlock = (gender: "male" | "female") => {
    const enabled = gender === "male" ? value.maleEnabled : value.femaleEnabled;
    const total = gender === "male" ? value.maleTotal : value.femaleTotal;
    const price = gender === "male" ? value.malePrice : value.femalePrice;
    const label = gender === "male" ? "Male beds" : "Female beds";
    const maxBeds = isPrivate ? 1 : 50;

    return (
      <div
        className={cn(
          "rounded-xl border border-[#2C2C2C]/10 bg-white p-4",
          enabled && "border-[#6B9E6E]/30 ring-1 ring-[#6B9E6E]/15",
        )}
      >
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-[#2C2C2C]">
          <input
            type="checkbox"
            name={`${gender}_enabled`}
            value="1"
            checked={enabled}
            onChange={(e) => {
              const on = e.target.checked;
              if (gender === "male") {
                onChange({
                  ...value,
                  maleEnabled: on,
                  maleTotal: on ? (isPrivate ? 1 : Math.max(1, value.maleTotal)) : 0,
                  femaleEnabled: isPrivate && on ? false : value.femaleEnabled,
                  femaleTotal: isPrivate && on ? 0 : value.femaleTotal,
                });
              } else {
                onChange({
                  ...value,
                  femaleEnabled: on,
                  femaleTotal: on ? (isPrivate ? 1 : Math.max(1, value.femaleTotal)) : 0,
                  maleEnabled: isPrivate && on ? false : value.maleEnabled,
                  maleTotal: isPrivate && on ? 0 : value.maleTotal,
                });
              }
            }}
            className="size-4 rounded border-[#2C2C2C]/20 text-[#6B9E6E]"
          />
          {label}
        </label>
        {enabled ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {!isPrivate ? (
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
                Number of beds
                <input
                  name={`${gender}_beds_total`}
                  type="number"
                  min={1}
                  max={maxBeds}
                  className={field}
                  required
                  value={total}
                  onChange={(e) => {
                    const n = Math.min(maxBeds, Math.max(1, parseInt(e.target.value, 10) || 1));
                    if (gender === "male") onChange({ ...value, maleTotal: n });
                    else onChange({ ...value, femaleTotal: n });
                  }}
                />
              </label>
            ) : (
              <input type="hidden" name={`${gender}_beds_total`} value="1" />
            )}
            <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
              Price per bed (₱/mo) *
              <input
                name={`${gender}_monthly_price`}
                type="number"
                min={500}
                className={field}
                required
                value={price}
                onChange={(e) => {
                  if (gender === "male") onChange({ ...value, malePrice: e.target.value });
                  else onChange({ ...value, femalePrice: e.target.value });
                }}
              />
            </label>
          </div>
        ) : (
          <>
            <input type="hidden" name={`${gender}_beds_total`} value="0" />
            <input type="hidden" name={`${gender}_monthly_price`} value="" />
          </>
        )}
      </div>
    );
  };

  const hint = useMemo(() => {
    if (isPrivate) return "Private room = 1 vacant unit. Pick male or female and set the monthly rent.";
    return "Turn on male and/or female beds, set how many, and price per bed.";
  }, [isPrivate]);

  return (
    <div className="space-y-4">
      {roomTypeSelect}
      <p className="text-xs font-medium text-[#888888]">{hint}</p>
      <div className="grid gap-3 sm:grid-cols-1">{genderBlock("male")}{genderBlock("female")}</div>
    </div>
  );
}

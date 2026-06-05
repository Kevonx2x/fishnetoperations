"use client";

import { useMemo } from "react";
import {
  defaultBedInventoryForRoomType,
  type BedInventoryFormValue,
} from "@/lib/dormspace-bed-inventory-form";
import {
  DORMSPACE_ROOM_TYPE_OPTIONS,
  type DormspaceRoomType,
} from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

export type { BedInventoryFormValue } from "@/lib/dormspace-bed-inventory-form";
export {
  bedInventoryFromListing,
  bedInventoryToFormFields,
  buildGenderBedDbFields,
  defaultBedInventoryForRoomType,
  parseBedInventoryFromFormData,
  validateBedInventory,
} from "@/lib/dormspace-bed-inventory-form";

const FIELD =
  "mt-1 w-full rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

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

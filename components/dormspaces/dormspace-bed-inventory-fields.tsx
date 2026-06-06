"use client";

import { BedDouble, Minus, Plus } from "lucide-react";
import {
  adjustGenderBunkTotal,
  BUNK_KIND_OPTIONS,
  bunkSummaryParts,
  defaultBunkRow,
  defaultBunksForGender,
  newBunkRowId,
  sumBunkCounts,
} from "@/lib/dormspace-bed-types";
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

const COMPACT_FIELD =
  "mt-1 w-full rounded-lg border border-[#2C2C2C]/10 bg-white px-2.5 py-2 text-sm font-medium text-[#2C2C2C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/25";

type Props = {
  value: BedInventoryFormValue;
  onChange: (next: BedInventoryFormValue) => void;
  fieldClassName?: string;
};

function Stepper({
  value,
  onDecrement,
  onIncrement,
  min = 0,
  max = 50,
}: {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#2C2C2C]/10 bg-[#FAF8F4] p-0.5">
      <button
        type="button"
        onClick={onDecrement}
        disabled={value <= min}
        className="flex size-8 items-center justify-center rounded-md text-[#525252] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Decrease bed count"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums text-[#2C2C2C]">
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        disabled={value >= max}
        className="flex size-8 items-center justify-center rounded-md text-[#525252] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
        aria-label="Increase bed count"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function SummaryToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-[#2C2C2C]"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-[#6B9E6E]" : "bg-[#2C2C2C]/15",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </span>
      Show bed summary
    </button>
  );
}

export function DormspaceBedInventoryFields({ value, onChange, fieldClassName }: Props) {
  const isPrivate = value.roomType === "private";
  const isMixed = value.roomType === "mixed";
  const field = fieldClassName ?? FIELD;

  const bunkKey = (gender: "male" | "female") => (gender === "male" ? "maleBunks" : "femaleBunks");

  const updateBunk = (
    gender: "male" | "female",
    rowId: string,
    patch: Partial<BedInventoryFormValue["maleBunks"][number]>,
  ) => {
    const key = bunkKey(gender);
    onChange({
      ...value,
      [key]: value[key].map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
    });
  };

  const setGenderRows = (gender: "male" | "female", rows: BedInventoryFormValue["maleBunks"]) => {
    const key = bunkKey(gender);
    onChange({ ...value, [key]: rows });
  };

  const addBunk = (gender: "male" | "female") => {
    const rows = value[bunkKey(gender)];
    const last = rows[rows.length - 1];
    // Alternate from last row (default is upper + lower; next add is upper, then lower, …)
    const nextBunk: "upper" | "lower" = last?.bunk === "upper" ? "lower" : "upper";
    setGenderRows(gender, [...rows, defaultBunkRow(nextBunk)]);
  };

  const removeBunk = (gender: "male" | "female", rowId: string) => {
    const rows = value[bunkKey(gender)];
    if (rows.length <= 1) return;
    setGenderRows(
      gender,
      rows.filter((r) => r.id !== rowId),
    );
  };

  const adjustTotal = (gender: "male" | "female", delta: number) => {
    const rows = value[bunkKey(gender)];
    setGenderRows(gender, adjustGenderBunkTotal(rows, delta));
  };

  const genderBlock = (gender: "male" | "female") => {
    const enabled = gender === "male" ? value.maleEnabled : value.femaleEnabled;
    const rows = gender === "male" ? value.maleBunks : value.femaleBunks;
    const label = gender === "male" ? "Male beds" : "Female beds";
    const derivedTotal = sumBunkCounts(rows);
    const totalLabel = gender === "male" ? "Number of male beds" : "Number of female beds";

    return (
      <div
        className={cn(
          "rounded-xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm",
          enabled && "border-[#6B9E6E]/25",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <label className="flex min-w-0 cursor-pointer items-center gap-2.5 text-sm font-bold text-[#2C2C2C]">
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
                    maleBunks: on && value.maleBunks.length === 0 ? defaultBunksForGender() : value.maleBunks,
                    femaleEnabled: isPrivate && on ? false : value.femaleEnabled,
                    femaleBunks: isPrivate && on ? defaultBunksForGender() : value.femaleBunks,
                  });
                } else {
                  onChange({
                    ...value,
                    femaleEnabled: on,
                    femaleBunks: on && value.femaleBunks.length === 0 ? defaultBunksForGender() : value.femaleBunks,
                    maleEnabled: isPrivate && on ? false : value.maleEnabled,
                    maleBunks: isPrivate && on ? defaultBunksForGender() : value.maleBunks,
                  });
                }
              }}
              className="size-4 rounded border-[#2C2C2C]/20 text-[#6B9E6E]"
            />
            {label}
          </label>
          {enabled && !isPrivate ? (
            <Stepper
              value={derivedTotal}
              onDecrement={() => adjustTotal(gender, -1)}
              onIncrement={() => adjustTotal(gender, 1)}
              max={50}
            />
          ) : null}
        </div>

        {enabled ? (
          <div className="mt-4 space-y-3">
            {isPrivate ? (
              <>
                <input type="hidden" name={`${gender}_beds_total`} value="1" />
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
                  Price per month (₱) *
                  <input
                    name={`${gender}_monthly_price`}
                    type="number"
                    min={500}
                    className={field}
                    required
                    value={rows[0]?.price ?? ""}
                    onChange={(e) => {
                      const key = bunkKey(gender);
                      const row = rows[0] ?? { ...defaultBunkRow("upper"), count: "1", id: newBunkRowId() };
                      onChange({
                        ...value,
                        [key]: [{ ...row, price: e.target.value, count: "1" }],
                      });
                    }}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
                  {totalLabel}
                  <input
                    type="number"
                    readOnly
                    tabIndex={-1}
                    aria-readonly="true"
                    className={cn(COMPACT_FIELD, "cursor-default bg-[#FAF8F4] text-[#2C2C2C]")}
                    value={derivedTotal}
                  />
                </label>

                <div className="space-y-3 rounded-xl border border-[#2C2C2C]/8 bg-[#FAF8F4]/80 p-3">
                  {rows.map((row) => {
                    const bunkMeta = BUNK_KIND_OPTIONS.find((o) => o.value === row.bunk);
                    return (
                      <div
                        key={row.id}
                        className="grid gap-3 rounded-lg border border-[#2C2C2C]/6 bg-white p-3 sm:grid-cols-[auto_1fr_1fr_1fr_auto] sm:items-end"
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#6B9E6E]/12 text-[#6B9E6E]">
                          <BedDouble className="size-5" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <select
                            className="w-full cursor-pointer border-0 bg-transparent p-0 text-sm font-bold text-[#2C2C2C] focus:ring-0"
                            value={row.bunk}
                            aria-label="Bunk type"
                            onChange={(e) =>
                              updateBunk(gender, row.id, {
                                bunk: e.target.value as "upper" | "lower",
                              })
                            }
                          >
                            {BUNK_KIND_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {bunkMeta?.hint ? (
                            <p className="text-xs font-medium text-[#888888]">{bunkMeta.hint}</p>
                          ) : null}
                        </div>
                        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#525252]">
                          Number of beds
                          <input
                            type="number"
                            min={0}
                            max={50}
                            className={COMPACT_FIELD}
                            value={row.count}
                            onChange={(e) => updateBunk(gender, row.id, { count: e.target.value })}
                          />
                        </label>
                        <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#525252]">
                          Price per bed (₱/mo)
                          <input
                            type="number"
                            min={500}
                            className={COMPACT_FIELD}
                            value={row.price}
                            onChange={(e) => updateBunk(gender, row.id, { price: e.target.value })}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeBunk(gender, row.id)}
                          disabled={rows.length <= 1}
                          className="flex size-9 items-center justify-center self-end rounded-full bg-red-50 text-red-500 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Remove bunk type"
                        >
                          <Minus className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => addBunk(gender)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6B9E6E] hover:underline"
                >
                  <Plus className="size-4" />
                  Add another bunk type
                </button>
              </>
            )}
          </div>
        ) : (
          <input type="hidden" name={`${gender}_beds_total`} value="0" />
        )}
      </div>
    );
  };

  const maleTotal = value.maleEnabled ? sumBunkCounts(value.maleBunks) : 0;
  const femaleTotal = value.femaleEnabled ? sumBunkCounts(value.femaleBunks) : 0;
  const totalBeds = maleTotal + femaleTotal;

  const hintText = isPrivate
    ? "Private room = 1 vacant unit. Pick male or female and set the monthly rent."
    : isMixed
      ? "Set the number of male and female beds, and price per bed. You can add upper and lower bunks with different prices."
      : "Set bed counts and price per bed by bunk type. Totals update from your bunk rows.";

  return (
    <div className="space-y-4">
      <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
        Room type *
        <select
          name="room_type"
          className={field}
          required
          value={value.roomType}
          onChange={(e) => {
            const rt = e.target.value as DormspaceRoomType;
            onChange(defaultBedInventoryForRoomType(rt));
          }}
        >
          {DORMSPACE_ROOM_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <p className="text-sm font-medium leading-snug text-[#484848]">{hintText}</p>

      <div className="grid gap-4 sm:grid-cols-1">
        {genderBlock("male")}
        {genderBlock("female")}
      </div>

      {!isPrivate ? (
        <div className="space-y-3">
          <SummaryToggle
            checked={value.showBedSummary}
            onChange={(on) => onChange({ ...value, showBedSummary: on })}
          />
          {value.showBedSummary ? (
            <div className="rounded-xl border border-[#6B9E6E]/20 bg-[#6B9E6E]/10 px-4 py-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B9E6E]">
                Bed summary
              </p>
              <ul className="mt-2 space-y-1 text-sm font-medium text-[#2C2C2C]">
                {value.maleEnabled ? <li>{bunkSummaryParts("male", value.maleBunks)}</li> : null}
                {value.femaleEnabled ? <li>{bunkSummaryParts("female", value.femaleBunks)}</li> : null}
                <li className="font-bold">Total beds: {totalBeds}</li>
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

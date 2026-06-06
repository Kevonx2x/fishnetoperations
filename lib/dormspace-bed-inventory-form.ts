import {
  bedTypesFromBunkRows,
  cheapestBunkPrice,
  defaultBunksForGender,
  defaultBunkRow,
  deriveLegacyFromBedTypes,
  parseBedTypesJson,
  sumBunkCounts,
  type BunkRowFormValue,
  type DormspaceBedTypeEntry,
} from "@/lib/dormspace-bed-types";
import { clampBedCountsForRoomType, type DormspaceGenderBedCounts } from "@/lib/dormspace-gender-beds";
import {
  DORMSPACE_ROOM_TYPE_OPTIONS,
  type DormspaceRoomType,
  type DormspaceRow,
} from "@/lib/dormspaces";

export type BedInventoryFormValue = {
  roomType: DormspaceRoomType;
  maleEnabled: boolean;
  femaleEnabled: boolean;
  maleBunks: BunkRowFormValue[];
  femaleBunks: BunkRowFormValue[];
  showBedSummary: boolean;
};

export function defaultBedInventoryForRoomType(roomType: DormspaceRoomType): BedInventoryFormValue {
  const isPrivate = roomType === "private";
  const isMixed = roomType === "mixed";
  return {
    roomType,
    maleEnabled: true,
    femaleEnabled: isMixed,
    maleBunks: isPrivate
      ? [{ ...defaultBunkRow("upper"), count: "1" }]
      : defaultBunksForGender(),
    femaleBunks: defaultBunksForGender(),
    showBedSummary: false,
  };
}

export function bedTypesFromFormValue(v: BedInventoryFormValue): DormspaceBedTypeEntry[] {
  const out: DormspaceBedTypeEntry[] = [];
  if (v.maleEnabled) out.push(...bedTypesFromBunkRows("male", v.maleBunks));
  if (v.femaleEnabled) out.push(...bedTypesFromBunkRows("female", v.femaleBunks));
  return out;
}

export function bedInventoryToFormFields(v: BedInventoryFormValue): Record<string, string> {
  const bedTypes = bedTypesFromFormValue(v);
  return {
    room_type: v.roomType,
    male_enabled: v.maleEnabled ? "1" : "0",
    female_enabled: v.femaleEnabled ? "1" : "0",
    bed_types_json: JSON.stringify(bedTypes),
    male_beds_total: String(v.maleEnabled ? sumBunkCounts(v.maleBunks) : 0),
    female_beds_total: String(v.femaleEnabled ? sumBunkCounts(v.femaleBunks) : 0),
    male_monthly_price: v.maleEnabled && cheapestBunkPrice(v.maleBunks) != null
      ? String(cheapestBunkPrice(v.maleBunks))
      : "",
    female_monthly_price: v.femaleEnabled && cheapestBunkPrice(v.femaleBunks) != null
      ? String(cheapestBunkPrice(v.femaleBunks))
      : "",
  };
}

export function parseBedInventoryFromFormData(form: FormData): BedInventoryFormValue | null {
  const roomType = String(form.get("room_type") ?? "").trim() as DormspaceRoomType;
  if (!DORMSPACE_ROOM_TYPE_OPTIONS.some((o) => o.value === roomType)) return null;

  const maleEnabled = form.get("male_enabled") === "1" || form.get("male_enabled") === "on";
  const femaleEnabled = form.get("female_enabled") === "1" || form.get("female_enabled") === "on";

  const jsonRaw = String(form.get("bed_types_json") ?? "").trim();
  let bedTypes: DormspaceBedTypeEntry[] = [];
  if (jsonRaw) {
    try {
      bedTypes = parseBedTypesJson(JSON.parse(jsonRaw));
    } catch {
      return null;
    }
  }

  if (bedTypes.length > 0) {
    const maleBunks: BunkRowFormValue[] = bedTypes
      .filter((b) => b.gender === "male")
      .map((b) => ({
        id: `srv-m-${b.bunk}-${b.count}`,
        bunk: b.bunk === "lower" ? "lower" : "upper",
        count: String(b.count),
        price: String(b.price),
      }));
    const femaleBunks: BunkRowFormValue[] = bedTypes
      .filter((b) => b.gender === "female")
      .map((b) => ({
        id: `srv-f-${b.bunk}-${b.count}`,
        bunk: b.bunk === "lower" ? "lower" : "upper",
        count: String(b.count),
        price: String(b.price),
      }));

    return {
      roomType,
      maleEnabled: maleEnabled && maleBunks.length > 0,
      femaleEnabled: femaleEnabled && femaleBunks.length > 0,
      maleBunks: maleBunks.length > 0 ? maleBunks : defaultBunksForGender(),
      femaleBunks: femaleBunks.length > 0 ? femaleBunks : defaultBunksForGender(),
      showBedSummary: false,
    };
  }

  return {
    roomType,
    maleEnabled,
    femaleEnabled,
    maleBunks: defaultBunksForGender(),
    femaleBunks: defaultBunksForGender(),
    showBedSummary: false,
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

  const bedTypes = bedTypesFromFormValue(v);
  if (bedTypes.length === 0) {
    return "Add at least one bunk row with bed count and price.";
  }

  for (const row of [...(v.maleEnabled ? v.maleBunks : []), ...(v.femaleEnabled ? v.femaleBunks : [])]) {
    const count = parseInt(row.count, 10);
    const price = Number(row.price);
    if (count > 0 && (!Number.isFinite(price) || price < 500)) {
      return "Each bunk with beds must have price ₱500 minimum.";
    }
    if (price >= 500 && (!Number.isFinite(count) || count <= 0)) {
      return "Set bed count for each priced bunk row.";
    }
  }

  const legacy = deriveLegacyFromBedTypes(bedTypes);
  if (legacy.total_beds < 1 || legacy.total_beds > 50) {
    return "Total beds must be between 1 and 50.";
  }
  if (legacy.male_beds_total > 50) return "Male beds cannot exceed 50.";
  if (legacy.female_beds_total > 50) return "Female beds cannot exceed 50.";

  if (isPrivate) {
    const total = legacy.male_beds_total + legacy.female_beds_total;
    if (total !== 1) return "Private room allows 1 bed total.";
  }

  if (legacy.monthly_price == null || legacy.monthly_price < 500) {
    return "Enter valid prices (₱500 minimum per bunk).";
  }

  return null;
}

function legacyBunksFromListing(row: DormspaceRow, gender: "male" | "female"): BunkRowFormValue[] {
  const total =
    gender === "male"
      ? Number(row.male_beds_total) || 0
      : Number(row.female_beds_total) || 0;
  const price =
    gender === "male"
      ? row.male_monthly_price
      : row.female_monthly_price;
  if (total <= 0) return [];
  const priceStr =
    price != null && Number.isFinite(Number(price)) && Number(price) > 0
      ? String(Math.round(Number(price)))
      : row.monthly_price != null
        ? String(Math.round(Number(row.monthly_price)))
        : "";
  return [{ id: `legacy-${gender}`, bunk: "upper", count: String(total), price: priceStr }];
}

export function bedInventoryFromListing(row: DormspaceRow & { bed_types?: unknown }): BedInventoryFormValue {
  const bedTypes = parseBedTypesJson(row.bed_types);
  if (bedTypes.length > 0) {
    const maleBunks = bedTypes
      .filter((b) => b.gender === "male")
      .map((b, i) => ({
        id: `edit-m-${i}-${b.bunk}`,
        bunk: (b.bunk === "lower" ? "lower" : "upper") as BunkRowFormValue["bunk"],
        count: String(b.count),
        price: String(b.price),
      }));
    const femaleBunks = bedTypes
      .filter((b) => b.gender === "female")
      .map((b, i) => ({
        id: `edit-f-${i}-${b.bunk}`,
        bunk: (b.bunk === "lower" ? "lower" : "upper") as BunkRowFormValue["bunk"],
        count: String(b.count),
        price: String(b.price),
      }));

    return {
      roomType: row.room_type,
      maleEnabled: maleBunks.length > 0,
      femaleEnabled: femaleBunks.length > 0,
      maleBunks: maleBunks.length > 0 ? maleBunks : defaultBunksForGender(),
      femaleBunks: femaleBunks.length > 0 ? femaleBunks : defaultBunksForGender(),
      showBedSummary: false,
    };
  }

  const maleBunks = legacyBunksFromListing(row, "male");
  const femaleBunks = legacyBunksFromListing(row, "female");
  return {
    roomType: row.room_type,
    maleEnabled: maleBunks.length > 0,
    femaleEnabled: femaleBunks.length > 0,
    maleBunks: maleBunks.length > 0 ? maleBunks : defaultBunksForGender(),
    femaleBunks: femaleBunks.length > 0 ? femaleBunks : defaultBunksForGender(),
    showBedSummary: false,
  };
}

export function buildGenderBedDbFields(
  v: BedInventoryFormValue,
  opts?: { maleAvailable?: number; femaleAvailable?: number },
): { payload: Record<string, unknown>; error: string | null } {
  const validationError = validateBedInventory(v);
  if (validationError) return { payload: {}, error: validationError };

  const bedTypes = bedTypesFromFormValue(v);
  const derived = deriveLegacyFromBedTypes(bedTypes);

  let counts: DormspaceGenderBedCounts = {
    maleTotal: derived.male_beds_total,
    maleAvailable: derived.male_beds_available,
    femaleTotal: derived.female_beds_total,
    femaleAvailable: derived.female_beds_available,
  };
  counts = clampBedCountsForRoomType(v.roomType, counts);

  if (opts?.maleAvailable != null && counts.maleTotal > 0) {
    counts.maleAvailable = Math.min(counts.maleTotal, Math.max(0, opts.maleAvailable));
  }
  if (opts?.femaleAvailable != null && counts.femaleTotal > 0) {
    counts.femaleAvailable = Math.min(counts.femaleTotal, Math.max(0, opts.femaleAvailable));
  }

  return {
    payload: {
      room_type: v.roomType,
      bed_types: bedTypes,
      male_beds_total: counts.maleTotal,
      male_beds_available: counts.maleAvailable,
      female_beds_total: counts.femaleTotal,
      female_beds_available: counts.femaleAvailable,
      male_monthly_price: derived.male_monthly_price,
      female_monthly_price: derived.female_monthly_price,
      total_beds: Math.max(1, counts.maleTotal + counts.femaleTotal),
      available_beds: counts.maleAvailable + counts.femaleAvailable,
      gender_preference: derived.gender_preference,
      monthly_price: derived.monthly_price,
    },
    error: null,
  };
}

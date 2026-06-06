import type {
  DormspaceGenderPreference,
  DormspaceRoomType,
  DormspaceRow,
  DormspaceStatus,
} from "@/lib/dormspaces";

export type DormspaceGenderBedCounts = {
  maleTotal: number;
  maleAvailable: number;
  femaleTotal: number;
  femaleAvailable: number;
};

export type DormspaceGenderBedPricing = {
  malePrice: number | null;
  femalePrice: number | null;
};

export type DormspaceGenderBedLine = {
  gender: "male" | "female";
  available: number;
  total: number;
  price: number | null;
};

function parseIntBed(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(50, Math.round(n)));
}

function parsePrice(v: number | string | null | undefined): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export type DormspaceGenderBedInput = {
  room_type?: DormspaceRoomType | null;
  total_beds?: number | string | null;
  available_beds?: number | string | null;
  gender_preference?: DormspaceGenderPreference | null;
  male_beds_total?: number | string | null;
  male_beds_available?: number | string | null;
  female_beds_total?: number | string | null;
  female_beds_available?: number | string | null;
  monthly_price?: number | string | null;
  male_monthly_price?: number | string | null;
  female_monthly_price?: number | string | null;
  status?: DormspaceStatus | null;
  hidden_from_browse?: boolean | null;
};

export function resolveDormspaceGenderBedCounts(row: DormspaceGenderBedInput): DormspaceGenderBedCounts {
  const maleTotal = parseIntBed(row.male_beds_total);
  const femaleTotal = parseIntBed(row.female_beds_total);

  if (maleTotal > 0 || femaleTotal > 0) {
    return {
      maleTotal,
      maleAvailable: Math.min(maleTotal, parseIntBed(row.male_beds_available)),
      femaleTotal,
      femaleAvailable: Math.min(femaleTotal, parseIntBed(row.female_beds_available)),
    };
  }

  // Legacy fallback
  const legacyTotal = parseIntBed(row.total_beds) || 1;
  const legacyAvail = Math.min(legacyTotal, parseIntBed(row.available_beds) ?? legacyTotal);
  const g = row.gender_preference ?? "any";
  if (g === "male") {
    return { maleTotal: legacyTotal, maleAvailable: legacyAvail, femaleTotal: 0, femaleAvailable: 0 };
  }
  if (g === "female") {
    return { maleTotal: 0, maleAvailable: 0, femaleTotal: legacyTotal, femaleAvailable: legacyAvail };
  }
  const half = Math.ceil(legacyTotal / 2);
  const maleT = half;
  const femaleT = legacyTotal - half;
  const maleA = Math.min(maleT, Math.ceil(legacyAvail / 2));
  const femaleA = Math.min(femaleT, legacyAvail - maleA);
  return {
    maleTotal: maleT,
    maleAvailable: maleA,
    femaleTotal: femaleT,
    femaleAvailable: femaleA,
  };
}

export function resolveDormspaceGenderBedPricing(
  row: Pick<
    DormspaceGenderBedInput,
    "monthly_price" | "male_monthly_price" | "female_monthly_price"
  >,
): DormspaceGenderBedPricing {
  const fallback = parsePrice(row.monthly_price);
  return {
    malePrice: parsePrice(row.male_monthly_price) ?? fallback,
    femalePrice: parsePrice(row.female_monthly_price) ?? fallback,
  };
}

/** Private room: at most one bed in one gender bucket. */
export function clampBedCountsForRoomType(
  roomType: DormspaceRoomType,
  counts: DormspaceGenderBedCounts,
): DormspaceGenderBedCounts {
  if (roomType !== "private") return counts;
  const maleTotal = counts.maleTotal > 0 ? 1 : 0;
  const femaleTotal = counts.femaleTotal > 0 ? 1 : 0;
  return {
    maleTotal,
    maleAvailable: maleTotal ? Math.min(1, counts.maleAvailable) : 0,
    femaleTotal,
    femaleAvailable: femaleTotal ? Math.min(1, counts.femaleAvailable) : 0,
  };
}

export function deriveGenderPreference(counts: DormspaceGenderBedCounts): DormspaceGenderPreference {
  if (counts.maleTotal > 0 && counts.femaleTotal > 0) return "any";
  if (counts.maleTotal > 0) return "male";
  if (counts.femaleTotal > 0) return "female";
  return "any";
}

export function syncLegacyBedFields(
  counts: DormspaceGenderBedCounts,
  pricing: DormspaceGenderBedPricing,
): {
  total_beds: number;
  available_beds: number;
  gender_preference: DormspaceGenderPreference;
  monthly_price: number | null;
} {
  const total = Math.max(1, counts.maleTotal + counts.femaleTotal);
  const available = counts.maleAvailable + counts.femaleAvailable;
  const prices = [pricing.malePrice, pricing.femalePrice].filter((p): p is number => p != null);
  const monthly_price = prices.length > 0 ? Math.min(...prices) : null;
  return {
    total_beds: total,
    available_beds: available,
    gender_preference: deriveGenderPreference(counts),
    monthly_price,
  };
}

export function dormspaceOpenGenderLines(row: DormspaceGenderBedInput): DormspaceGenderBedLine[] {
  const counts = resolveDormspaceGenderBedCounts(row);
  const pricing = resolveDormspaceGenderBedPricing(row);
  const lines: DormspaceGenderBedLine[] = [];
  if (counts.maleTotal > 0 && counts.maleAvailable > 0) {
    lines.push({
      gender: "male",
      available: counts.maleAvailable,
      total: counts.maleTotal,
      price: pricing.malePrice,
    });
  }
  if (counts.femaleTotal > 0 && counts.femaleAvailable > 0) {
    lines.push({
      gender: "female",
      available: counts.femaleAvailable,
      total: counts.femaleTotal,
      price: pricing.femalePrice,
    });
  }
  return lines;
}

export function dormspaceCardAvailabilityText(row: DormspaceGenderBedInput): string | null {
  const lines = dormspaceOpenGenderLines(row);
  if (lines.length === 0) return null;
  return lines
    .map((l) => {
      const bedWord = l.available === 1 ? "bed" : "beds";
      return `${l.available} ${l.gender} ${bedWord}`;
    })
    .join(" · ");
}

export function dormspaceCardFromPrice(row: DormspaceGenderBedInput): number | null {
  const lines = dormspaceOpenGenderLines(row);
  const prices = lines.map((l) => l.price).filter((p): p is number => p != null);
  if (prices.length > 0) return Math.min(...prices);
  return parsePrice(row.monthly_price);
}

/** Compact per-gender "from" pricing for browse cards (mixed / dual-gender listings). */
export function dormspaceCardPriceLabel(
  row: DormspaceGenderBedInput,
  formatPrice: (n: number | string) => string,
): string | null {
  const lines = dormspaceOpenGenderLines(row);
  if (lines.length === 0) {
    const fallback = dormspaceCardFromPrice(row);
    return fallback != null ? `From ${formatPrice(fallback)}` : null;
  }
  if (lines.length === 1) {
    const l = lines[0]!;
    return l.price != null ? `From ${formatPrice(l.price)}` : null;
  }
  const male = lines.find((l) => l.gender === "male");
  const female = lines.find((l) => l.gender === "female");
  const parts: string[] = [];
  if (male?.price != null) parts.push(`Male from ${formatPrice(male.price)}`);
  if (female?.price != null) parts.push(`Female from ${formatPrice(female.price)}`);
  return parts.length > 0 ? parts.join(" / ") : null;
}

export function dormspaceImagePillLabel(row: DormspaceGenderBedInput): string {
  const counts = resolveDormspaceGenderBedCounts(row);
  const isPrivate = row.room_type === "private";
  if (isPrivate) {
    if (counts.maleTotal > 0) return "Private · Male";
    if (counts.femaleTotal > 0) return "Private · Female";
    return "Private room";
  }
  const open = dormspaceOpenGenderLines(row);
  if (open.length === 1) {
    const l = open[0]!;
    return `${l.available} ${l.gender} ${l.available === 1 ? "bed" : "beds"}`;
  }
  if (open.length === 2 || row.room_type === "mixed") {
    return "Male & female beds";
  }
  return isPrivate ? "Private room" : "Shared room";
}

export function isDormspaceFullyBooked(row: DormspaceGenderBedInput): boolean {
  const counts = resolveDormspaceGenderBedCounts(row);
  if (counts.maleTotal === 0 && counts.femaleTotal === 0) return false;
  return counts.maleAvailable === 0 && counts.femaleAvailable === 0;
}

/** Public homepage / browse rows — approved, not hidden, at least one open bed. */
export function isDormspaceVisibleOnBrowse(row: DormspaceGenderBedInput): boolean {
  if (row.status !== "approved") return false;
  if (row.hidden_from_browse) return false;
  return !isDormspaceFullyBooked(row);
}

export function formatGenderBedPriceLine(line: DormspaceGenderBedLine): string {
  const bedWord = line.available === 1 ? "bed" : "beds";
  const avail = `${line.available} ${line.gender} ${bedWord} available`;
  if (line.price == null) return avail;
  const formatted = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(line.price);
  return `${avail} · ₱${formatted}/mo each`;
}

export function formatGenderBedDetailBlock(
  row: DormspaceGenderBedInput,
): { open: DormspaceGenderBedLine[]; full: Array<{ gender: "male" | "female"; total: number }> } {
  const counts = resolveDormspaceGenderBedCounts(row);
  const pricing = resolveDormspaceGenderBedPricing(row);
  const open: DormspaceGenderBedLine[] = [];
  const full: Array<{ gender: "male" | "female"; total: number }> = [];

  if (counts.maleTotal > 0) {
    if (counts.maleAvailable > 0) {
      open.push({
        gender: "male",
        available: counts.maleAvailable,
        total: counts.maleTotal,
        price: pricing.malePrice,
      });
    } else {
      full.push({ gender: "male", total: counts.maleTotal });
    }
  }
  if (counts.femaleTotal > 0) {
    if (counts.femaleAvailable > 0) {
      open.push({
        gender: "female",
        available: counts.femaleAvailable,
        total: counts.femaleTotal,
        price: pricing.femalePrice,
      });
    } else {
      full.push({ gender: "female", total: counts.femaleTotal });
    }
  }
  return { open, full };
}

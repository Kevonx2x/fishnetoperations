export interface MarketplaceAgent {
  id: string;
  userId: string;
  name: string;
  image: string;
  company: string;
  score: number;
  closings: number;
  responseTime: string;
  availability: string;
  /** From `agents.updated_at` when loaded from DB. */
  updatedAt: string;
  brokerId: string | null;
  brokerName: string;
  brokerLogo: string;
  /** Present when loaded from full agent row (e.g. property page). */
  email: string;
  phone: string;
  verified: boolean;
  status: string;
  /** When loaded from agents row: raw service areas string for city matching. */
  serviceAreasText?: string;
}

type SupabaseBrokersJoin =
  | {
      id?: string | null;
      company_name?: string | null;
      logo_url?: string | null;
    }
  | null
  | undefined;

type ProfileJoinShape = {
  email?: string | null;
  phone?: string | null;
  role?: string | null;
};

function profileJoinFields(p: ProfileJoinShape | ProfileJoinShape[] | null | undefined): ProfileJoinShape | null {
  if (p == null) return null;
  if (Array.isArray(p)) return p[0] ?? null;
  return p;
}

type SupabaseAgentsRow = {
  id?: string | null;
  user_id?: string | null;
  /** Semicolon/comma-separated cities/areas (directory + matching). */
  service_areas?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  image_url?: string | null;
  score?: number | string | null;
  closings?: number | string | null;
  response_time?: string | null;
  availability?: string | null;
  updated_at?: string | null;
  verified?: boolean | null;
  status?: string | null;
  brokers?: SupabaseBrokersJoin;
  /** From `.select(..., profiles(email, phone, role))` join on agents.user_id → profiles.id */
  profiles?: ProfileJoinShape | ProfileJoinShape[];
};

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function safeNumber(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function mapRowToMarketplaceAgent(row: SupabaseAgentsRow): MarketplaceAgent {
  const brokers = (row.brokers ?? null) as SupabaseBrokersJoin;
  const prof = profileJoinFields(row.profiles);
  /** Always pass through DB `agents.availability` as-is (null/undefined → ""). Never default to "Available Now". */
  const availabilityFromDb = row.availability;
  return {
    id: safeString(row.id),
    userId: safeString(row.user_id),
    name: safeString(row.name),
    image: safeString(row.image_url),
    company: safeString(brokers?.company_name),
    score: safeNumber(row.score),
    closings: Math.round(safeNumber(row.closings)),
    responseTime: safeString(row.response_time),
    availability:
      availabilityFromDb == null ? "" : typeof availabilityFromDb === "string" ? availabilityFromDb : String(availabilityFromDb),
    updatedAt: safeString(row.updated_at),
    brokerId: typeof brokers?.id === "string" ? brokers.id : null,
    brokerName: safeString(brokers?.company_name),
    brokerLogo: safeString(brokers?.logo_url),
    email: safeString(row.email) || safeString(prof?.email),
    phone: safeString(row.phone) || safeString(prof?.phone),
    verified: row.verified === true,
    status: safeString(row.status),
    serviceAreasText:
      typeof row.service_areas === "string" && row.service_areas.trim()
        ? row.service_areas.trim()
        : undefined,
  };
}


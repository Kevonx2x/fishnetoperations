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
  brokerId: string | null;
  brokerName: string;
  brokerLogo: string;
  /** Present when loaded from full agent row (e.g. property page). */
  email: string;
  phone: string;
  verified: boolean;
  status: string;
}

type SupabaseBrokersJoin =
  | {
      id?: string | null;
      company_name?: string | null;
      logo_url?: string | null;
    }
  | null
  | undefined;

type SupabaseAgentsRow = {
  id?: string | null;
  user_id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  image_url?: string | null;
  score?: number | string | null;
  closings?: number | string | null;
  response_time?: string | null;
  availability?: string | null;
  verified?: boolean | null;
  status?: string | null;
  brokers?: SupabaseBrokersJoin;
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
  return {
    id: safeString(row.id),
    userId: safeString(row.user_id),
    name: safeString(row.name),
    image: safeString(row.image_url),
    company: safeString(brokers?.company_name),
    score: safeNumber(row.score),
    closings: Math.round(safeNumber(row.closings)),
    responseTime: safeString(row.response_time),
    availability: safeString(row.availability),
    brokerId: typeof brokers?.id === "string" ? brokers.id : null,
    brokerName: safeString(brokers?.company_name),
    brokerLogo: safeString(brokers?.logo_url),
    email: safeString(row.email),
    phone: safeString(row.phone),
    verified: row.verified === true,
    status: safeString(row.status),
  };
}


import type { SupabaseClient } from "@supabase/supabase-js";
import {
  manilaMonthDayLabelFromInstant,
  manilaTimeLabel12hFromInstant,
  manilaWeekdayShortFromInstant,
} from "@/lib/manila-datetime";

export type LeadActivityEventKind =
  | "lead_received"
  | "viewing_requested"
  | "viewing_scheduled"
  | "viewing_rescheduled"
  | "viewing_cancelled"
  | "viewing_completed"
  | "document_requested"
  | "document_uploaded"
  | "offer_made"
  | "reservation_created"
  | "deal_closed";

export type LeadActivityEvent = {
  kind: LeadActivityEventKind;
  timestamp: string;
  label: string;
  sublabel: string;
};

export type LeadActivityLeadContext = {
  id: number;
  created_at: string;
  viewing_request_id?: string | null;
  property_id?: string | null;
  client_id?: string | null;
  closed_date?: string | null;
  closed_at?: string | null;
};

type ViewingRow = {
  id: string;
  created_at: string;
  updated_at: string;
  scheduled_at: string;
  status: string;
  reschedule_request_id?: string | null;
  notes?: string | null;
};

type ViewingRequestRow = {
  id: string;
  created_at: string;
  scheduled_at: string | null;
  preferred_date?: string | null;
  preferred_time?: string | null;
};

type DealDocumentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: string | null;
  direction: string | null;
  document_name: string | null;
  document_type: string | null;
};

type OfferRow = {
  id: string;
  created_at: string;
  amount: number | string;
  currency: string | null;
};

type ReservationRow = {
  id: string;
  created_at: string;
  amount: number | string;
  currency: string | null;
};

export type LeadActivityBundle = {
  viewings: ViewingRow[];
  viewingRequests: ViewingRequestRow[];
  dealDocuments: DealDocumentRow[];
  offers: OfferRow[];
  reservations: ReservationRow[];
};

const activityCache = new Map<number, LeadActivityBundle>();

export function clearLeadActivityCache(leadId?: number) {
  if (leadId == null) activityCache.clear();
  else activityCache.delete(leadId);
}

export async function fetchLeadActivityBundle(
  supabase: SupabaseClient,
  lead: LeadActivityLeadContext,
): Promise<LeadActivityBundle> {
  const cached = activityCache.get(lead.id);
  if (cached) return cached;

  const { data: leadRow, error: leadErr } = await supabase
    .from("leads")
    .select(
      `
      viewings(id, created_at, updated_at, scheduled_at, status, reschedule_request_id, notes),
      deal_documents(id, created_at, updated_at, status, direction, document_name, document_type),
      offers(id, created_at, amount, currency),
      reservations(id, created_at, amount, currency)
    `,
    )
    .eq("id", lead.id)
    .maybeSingle();

  if (leadErr) {
    console.warn("[lead-activity] nested lead fetch failed", { leadId: lead.id, message: leadErr.message });
  }

  const row = (leadRow ?? {}) as {
    viewings?: ViewingRow[] | null;
    deal_documents?: DealDocumentRow[] | null;
    offers?: OfferRow[] | null;
    reservations?: ReservationRow[] | null;
  };

  const viewings = (row.viewings ?? []) as ViewingRow[];
  const dealDocuments = (row.deal_documents ?? []) as DealDocumentRow[];
  const offers = (row.offers ?? []) as OfferRow[];
  const reservations = (row.reservations ?? []) as ReservationRow[];

  const vrIds = new Set<string>();
  const linkedVr = lead.viewing_request_id?.trim();
  if (linkedVr) vrIds.add(linkedVr);
  for (const v of viewings) {
    const rid = (v.reschedule_request_id ?? "").trim();
    if (rid) vrIds.add(rid);
  }

  let viewingRequests: ViewingRequestRow[] = [];
  if (vrIds.size > 0) {
    const { data: vrData, error: vrErr } = await supabase
      .from("viewing_requests")
      .select("id, created_at, scheduled_at, preferred_date, preferred_time")
      .in("id", [...vrIds]);
    if (vrErr) {
      console.warn("[lead-activity] viewing_requests fetch failed", { leadId: lead.id, message: vrErr.message });
    } else {
      viewingRequests = (vrData ?? []) as ViewingRequestRow[];
    }
  }

  const bundle: LeadActivityBundle = {
    viewings,
    viewingRequests,
    dealDocuments,
    offers,
    reservations,
  };
  activityCache.set(lead.id, bundle);
  return bundle;
}

export function formatViewingSlotSublabel(iso: string | null | undefined): string {
  const raw = (iso ?? "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "";
  return `${manilaWeekdayShortFromInstant(d)} ${manilaMonthDayLabelFromInstant(d)} · ${manilaTimeLabel12hFromInstant(d)}`;
}

export function formatActivityTimelineRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 30) return "Just now";
  if (diffSec < 60) return "1m ago";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const now = new Date();
  const d = new Date(t);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startD = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startToday - startD) / 86400000);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return manilaMonthDayLabelFromInstant(d);
}

function formatMoney(amount: number | string, currency: string | null): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "";
  const cur = (currency ?? "PHP").trim() || "PHP";
  try {
    return new Intl.NumberFormat("en-PH", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${cur} ${n.toLocaleString("en-PH")}`;
  }
}

function documentLabel(doc: DealDocumentRow): string {
  const name = (doc.document_name ?? "").trim();
  if (name) return name;
  const type = (doc.document_type ?? "").trim();
  if (type) return type.replace(/_/g, " ");
  return "Document";
}

function leadReceivedSublabel(lead: LeadActivityLeadContext): string {
  if (lead.viewing_request_id?.trim()) return "via viewing request";
  if (lead.property_id?.trim()) return "via direct inquiry";
  return "";
}

function viewingRequestSlotSublabel(vr: ViewingRequestRow): string {
  if (vr.scheduled_at?.trim()) return formatViewingSlotSublabel(vr.scheduled_at);
  const pd = (vr.preferred_date ?? "").trim();
  const pt = (vr.preferred_time ?? "").trim();
  if (pd && pt) return `${pd} · ${pt}`;
  if (pd) return pd;
  return "";
}

export function buildLeadActivityEvents(
  lead: LeadActivityLeadContext,
  bundle: LeadActivityBundle,
): LeadActivityEvent[] {
  const events: LeadActivityEvent[] = [];

  events.push({
    kind: "lead_received",
    timestamp: lead.created_at,
    label: "Lead received",
    sublabel: leadReceivedSublabel(lead),
  });

  for (const vr of bundle.viewingRequests) {
    events.push({
      kind: "viewing_requested",
      timestamp: vr.created_at,
      label: "Viewing requested by client",
      sublabel: viewingRequestSlotSublabel(vr),
    });
  }

  for (const v of bundle.viewings) {
    const status = (v.status ?? "scheduled").trim().toLowerCase();
    const createdMs = new Date(v.created_at).getTime();
    const updatedMs = new Date(v.updated_at).getTime();

    if (status !== "cancelled") {
      events.push({
        kind: "viewing_scheduled",
        timestamp: v.created_at,
        label: "Viewing scheduled",
        sublabel: formatViewingSlotSublabel(v.scheduled_at),
      });
    }

    if (status === "scheduled" && Number.isFinite(createdMs) && Number.isFinite(updatedMs) && updatedMs - createdMs > 120_000) {
      events.push({
        kind: "viewing_rescheduled",
        timestamp: v.updated_at,
        label: "Viewing rescheduled",
        sublabel: formatViewingSlotSublabel(v.scheduled_at),
      });
    }

    if (status === "cancelled") {
      events.push({
        kind: "viewing_cancelled",
        timestamp: v.updated_at || v.created_at,
        label: "Viewing cancelled",
        sublabel: (v.notes ?? "").trim(),
      });
    }

    if (status === "completed") {
      events.push({
        kind: "viewing_completed",
        timestamp: v.updated_at || v.created_at,
        label: "Viewing completed",
        sublabel: "",
      });
    }
  }

  for (const doc of bundle.dealDocuments) {
    const direction = (doc.direction ?? "").trim().toLowerCase();
    const status = (doc.status ?? "").trim().toLowerCase();

    if (direction === "requested" && status === "pending") {
      events.push({
        kind: "document_requested",
        timestamp: doc.created_at,
        label: "Document requested",
        sublabel: documentLabel(doc),
      });
    }

    if (status === "uploaded") {
      const uploadedAt =
        doc.updated_at && doc.updated_at !== doc.created_at ? doc.updated_at : doc.created_at;
      events.push({
        kind: "document_uploaded",
        timestamp: uploadedAt,
        label: "Document uploaded by client",
        sublabel: documentLabel(doc),
      });
    }
  }

  for (const offer of bundle.offers) {
    const sub = formatMoney(offer.amount, offer.currency);
    events.push({
      kind: "offer_made",
      timestamp: offer.created_at,
      label: "Offer made",
      sublabel: sub,
    });
  }

  for (const res of bundle.reservations) {
    const sub = formatMoney(res.amount, res.currency);
    events.push({
      kind: "reservation_created",
      timestamp: res.created_at,
      label: "Reservation created",
      sublabel: sub,
    });
  }

  const closedIso = (lead.closed_at ?? lead.closed_date ?? "").trim();
  if (closedIso) {
    events.push({
      kind: "deal_closed",
      timestamp: closedIso.includes("T") ? closedIso : `${closedIso}T12:00:00+08:00`,
      label: "Deal closed",
      sublabel: "",
    });
  }

  const sorted = events
    .filter((e) => e.timestamp && Number.isFinite(new Date(e.timestamp).getTime()))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return sorted.slice(0, 8);
}

import type { NotificationListItem } from "@/components/notifications/notification-list";
import { viewingRequestNotificationDisplay } from "@/components/notifications/notification-list";
import { manilaCalendarAddDays, manilaDateStringFromInstant, manilaStartOfWeekSundayYmd } from "@/lib/manila-datetime";

export type ClientNotificationDayBucket = "today" | "yesterday" | "this_week" | "earlier";

/** Group notification `created_at` in Asia/Manila: Today / Yesterday / This week / Earlier. */
export function clientNotificationManilaDayBucket(iso: string): ClientNotificationDayBucket {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "earlier";
  const then = new Date(t);
  const nowYmd = manilaDateStringFromInstant(new Date());
  const thenYmd = manilaDateStringFromInstant(then);
  if (thenYmd === nowYmd) return "today";
  const yYesterday = manilaCalendarAddDays(nowYmd, -1);
  if (thenYmd === yYesterday) return "yesterday";
  const weekStart = manilaStartOfWeekSundayYmd(nowYmd);
  if (thenYmd >= weekStart && thenYmd <= nowYmd && thenYmd !== nowYmd && thenYmd !== yYesterday) return "this_week";
  return "earlier";
}

const VIEWING_CAL_TYPES = new Set([
  "viewing_request",
  "viewing_confirmed",
  "viewing_declined",
  "viewing_cancelled",
  "viewing_reminder",
  "viewing_reschedule_requested",
  "viewing_reschedule_accepted",
  "viewing_reschedule_declined",
  "viewing_reschedule_countered",
]);

/** Lucide icon key for mapping in UI (import icons in component). */
export function clientNotificationIconKey(type: string): string {
  const t = type.toLowerCase();
  if (VIEWING_CAL_TYPES.has(t) || t === "client_feed_viewing") return "calendar";
  if (
    t === "new_lead" ||
    t === "lead_created" ||
    t === "deal_pipeline" ||
    t === "lead_archived" ||
    t === "deal_declined"
  )
    return "home";
  if (t === "document_request" || t === "document_shared" || t === "document_received") return "filetext";
  if (t === "agent_message" || t === "message" || t === "client_reply") return "messagesquare";
  if (t === "client_feed_property_like" || t === "client_feed_property_save") return "heart";
  if (t === "client_feed_badge") return "award";
  if (t === "client_feed_price_drop") return "trendingdown";
  if (t === "verification" || t === "verification_approved") return "badgecheck";
  if (t === "agent_pending_review") return "clock";
  if (t === "co_agent_request") return "users";
  if (t === "offer_sent") return "handshake";
  return "bell";
}

export function clientNotificationHeadline(n: NotificationListItem): string {
  const t = n.type.toLowerCase();
  const map: Record<string, string> = {
    viewing_request: "Viewing requested",
    viewing_confirmed: "Viewing scheduled",
    viewing_declined: "Viewing declined",
    viewing_cancelled: "Viewing cancelled",
    viewing_reminder: "Viewing reminder",
    viewing_reschedule_requested: "Reschedule requested",
    viewing_reschedule_accepted: "Reschedule accepted",
    viewing_reschedule_declined: "Reschedule declined",
    viewing_reschedule_countered: "Reschedule counter offered",
    document_request: "Document requested",
    document_shared: "Document shared",
    document_received: "Document received",
    agent_message: "New message",
    message: "New message",
    client_reply: "New message",
    client_feed_property_like: "Property liked",
    client_feed_property_save: "Property saved",
    client_feed_badge: "Badge earned",
    client_feed_viewing: "Viewing activity",
    client_feed_price_drop: "Price drop",
    verification: "Verification update",
    verification_approved: "Verification approved",
    offer_sent: "Offer sent",
    new_lead: "New lead",
    lead_created: "New lead",
    deal_pipeline: "Pipeline update",
  };
  if (map[t]) return map[t];
  const title = n.title?.trim();
  if (title) return title;
  return "Update";
}

export function clientNotificationBodyPlain(n: NotificationListItem): string {
  if (n.type === "viewing_request") {
    const { body } = viewingRequestNotificationDisplay(n);
    return (body?.trim() || n.body || n.title || "").trim();
  }
  const b = n.body?.trim();
  if (b) return b;
  return (n.title?.trim() || "").trim();
}

export function clientNotificationActorName(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const a = (metadata as Record<string, unknown>).actor_name;
  return typeof a === "string" && a.trim() ? a.trim() : null;
}

export function clientNotificationRowHref(n: NotificationListItem, currentUserId: string): string {
  const t = n.type.toLowerCase();
  const meta = (n.metadata ?? {}) as Record<string, unknown>;
  const pid = typeof meta.property_id === "string" ? meta.property_id.trim() : "";

  if (t.startsWith("viewing_")) return "/dashboard/client/pipeline";
  if (t === "document_request" || t === "document_shared" || t === "document_received")
    return "/dashboard/client/pipeline";
  if (t === "agent_message" || t === "message" || t === "client_reply") return "/dashboard/client/messages";
  if (t === "client_feed_property_like" || t === "client_feed_property_save" || t === "client_feed_price_drop") {
    if (pid) return `/properties/${encodeURIComponent(pid)}`;
    return "/dashboard/client";
  }
  if (t === "client_feed_badge") return `/clients/${encodeURIComponent(currentUserId)}`;
  return "/dashboard/client";
}

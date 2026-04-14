"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";
import { cloudinaryPropertyPhotoDisplayUrl } from "@/lib/cloudinary-property-photo-url";

export type PropertyPhoto = { url: string; sort_order: number | null };

export type PropertyRow = {
  id: string;
  name: string | null;
  location: string;
  price: string;
  status: "for_sale" | "for_rent" | "sold" | "rented" | "both";
  image_url: string;
  created_at?: string;
  property_photos?: PropertyPhoto[] | null;
};

export type SavedJoinRow = { created_at: string; properties: PropertyRow | PropertyRow[] | null };
export type LikeJoinRow = {
  property_id: string;
  created_at: string;
  properties: PropertyRow | PropertyRow[] | null;
};

export function oneProperty(p: PropertyRow | PropertyRow[] | null | undefined): PropertyRow | null {
  if (!p) return null;
  return Array.isArray(p) ? (p[0] ?? null) : p;
}

export type ClientDocRow = {
  id: string;
  created_at: string;
  document_type: string;
  file_url: string;
  file_name: string | null;
};

export type SharedDocRow = {
  id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};


export type BadgeSlug =
  | "first-save"
  | "smart-shopper"
  | "active-hunter"
  | "early-adopter"
  | "document-ready"
  | "welcome-home"
  | "neighborhood-scout"
  | "committed"
  | "in-the-pipeline"
  | "signed-and-sealed"
  | "document-pro"
  | "social-saver";

export const BADGE_ORDER: BadgeSlug[] = [
  "first-save",
  "smart-shopper",
  "active-hunter",
  "early-adopter",
  "document-ready",
  "welcome-home",
  "neighborhood-scout",
  "committed",
  "in-the-pipeline",
  "signed-and-sealed",
  "document-pro",
  "social-saver",
];

const KNOWN_BADGE_SLUGS = new Set<string>(BADGE_ORDER);

export function normalizeBadgeSlug(raw: string | null | undefined): BadgeSlug | null {
  const t = (raw ?? "").trim();
  return KNOWN_BADGE_SLUGS.has(t) ? (t as BadgeSlug) : null;
}

export type FeedNotificationRow = {
  id: string;
  created_at: string;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
};

export type FeedUnion =
  | {
      kind: "saved_property";
      sortAt: string;
      property: PropertyRow;
      created_at: string;
      saveKey: string;
    }
  | {
      kind: "agent";
      sortAt: string;
      notification: FeedNotificationRow;
      agentPhone: string | null;
      property?: PropertyRow | null;
      propertyId: string;
      imageUrl: string;
      priceDisplay: string;
      showSavedPill: boolean;
    }
  | {
      kind: "price_drop_al";
      sortAt: string;
      id: string;
      propertyId: string;
      propertyName: string;
      oldPrice: string;
      newPrice: string;
      thumbUrl: string;
    }
  | {
      kind: "listing_edited_al";
      sortAt: string;
      id: string;
      propertyId: string;
      propertyName: string;
      editedByName: string;
      thumbUrl: string;
    }
  | {
      kind: "badge";
      sortAt: string;
      notification: FeedNotificationRow;
    }
  | {
      kind: "badge_earned";
      sortAt: string;
      badge_slug: BadgeSlug;
      earned_at: string;
      feedKey: string;
    }
  | {
      kind: "viewing_confirmed";
      sortAt: string;
      notification: FeedNotificationRow;
    }
  | {
      kind: "pin_activity";
      sortAt: string;
      likeKey: string;
      property: PropertyRow;
      created_at: string;
    }
  | {
      kind: "followed_agent_listing";
      sortAt: string;
      feedKey: string;
      property: PropertyRow;
      agent: { id: string; name: string; image_url: string | null };
    };

/** YYYY-MM-DD in UTC for grouping feed dedupe keys. */
function feedDayKeyUtc(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unknown";
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * One card per property per event type per calendar day (UTC): keep the most recent
 * price_drop_al / listing_edited_al by sortAt.
 */
export function dedupeListingActivityFeedItems(items: FeedUnion[]): FeedUnion[] {
  const map = new Map<string, FeedUnion>();
  const rest: FeedUnion[] = [];
  for (const item of items) {
    if (item.kind !== "price_drop_al" && item.kind !== "listing_edited_al") {
      rest.push(item);
      continue;
    }
    const eventType = item.kind === "price_drop_al" ? "price_drop" : "listing_edited";
    const key = `${item.propertyId}|${eventType}|${feedDayKeyUtc(item.sortAt)}`;
    const prev = map.get(key);
    if (!prev || Date.parse(item.sortAt) > Date.parse(prev.sortAt)) {
      map.set(key, item);
    }
  }
  return [...rest, ...map.values()].sort((a, b) => Date.parse(b.sortAt) - Date.parse(a.sortAt));
}

export type NotifPrefs = {
  price_drop: boolean;
  new_listing_followed_agent: boolean;
  badge_earned: boolean;
  document_request: boolean;
  pipeline_stage: boolean;
  viewing_request_confirmed: boolean;
};

export function parseNotifPrefs(raw: unknown): NotifPrefs {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    price_drop: o.price_drop !== false,
    new_listing_followed_agent: o.new_listing_followed_agent !== false,
    badge_earned: o.badge_earned !== false,
    document_request: o.document_request !== false,
    pipeline_stage: o.pipeline_stage !== false,
    viewing_request_confirmed: o.viewing_request_confirmed !== false,
  };
}

export function filterFeedByPrefs(items: FeedUnion[], prefs: NotifPrefs): FeedUnion[] {
  return items.filter((item) => {
    if (item.kind === "saved_property") return true;
    if (item.kind === "followed_agent_listing") return prefs.new_listing_followed_agent;
    if (item.kind === "price_drop_al" || item.kind === "listing_edited_al") return prefs.price_drop;
    if (item.kind === "badge") return prefs.badge_earned;
    if (item.kind === "badge_earned") return prefs.badge_earned;
    if (item.kind === "agent") return prefs.viewing_request_confirmed;
    if (item.kind === "viewing_confirmed") return prefs.viewing_request_confirmed;
    return true;
  });
}

export function pickPropertyImage(p: PropertyRow): string {
  const photos = p.property_photos;
  if (photos?.length) {
    const sorted = [...photos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const u = sorted[0]?.url?.trim();
    if (u) return cloudinaryPropertyPhotoDisplayUrl(u);
  }
  return p.image_url?.trim() || "";
}

export function stripPhoneDigits(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = raw.replace(/\D/g, "");
  return d.length >= 10 ? d : null;
}

export function metaStr(m: Record<string, unknown> | null | undefined, key: string): string {
  const v = m?.[key];
  return typeof v === "string" ? v : "";
}

/** activity_log rows that only reflect client like/pin/save/heart side effects — exclude from listing-update feed. */
export function activityLogMetadataIndicatesEngagementOnly(m: Record<string, unknown> | null | undefined): boolean {
  if (!m) return false;
  const source = String(m.source ?? "").toLowerCase();
  const trigger = String(m.trigger ?? m.triggered_by ?? "").toLowerCase();
  const t = String(m.type ?? "").toLowerCase();
  if (m.from_engagement === true || m.from_like === true || m.from_pin === true || m.from_save === true || m.from_heart === true) {
    return true;
  }
  if (typeof m.engagement === "string" && ["like", "pin", "heart", "save"].includes(m.engagement.toLowerCase())) {
    return true;
  }
  const engagementSources = new Set([
    "like",
    "pin",
    "pin_save",
    "heart",
    "save",
    "property_like",
    "saved_property",
    "engagement",
    "engagement_notify",
  ]);
  if (engagementSources.has(source) || engagementSources.has(trigger) || engagementSources.has(t)) return true;
  return false;
}

export type TimeBucket = "today" | "yesterday" | "this_week" | "earlier";

const BUCKET_LABEL: Record<TimeBucket, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  earlier: "Earlier",
};

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function bucketForDate(iso: string): TimeBucket {
  const t = new Date(iso).getTime();
  const now = new Date();
  const sod = startOfLocalDay(now).getTime();
  const dayMs = 86400000;
  if (t >= sod) return "today";
  if (t >= sod - dayMs) return "yesterday";
  if (t >= sod - 7 * dayMs) return "this_week";
  return "earlier";
}

export type ListingMode = "rent" | "sale";

export function propertyMatchesListingMode(
  p: PropertyRow | null | undefined,
  mode: ListingMode,
): boolean {
  if (!p) return true;
  if (p.status === "both") return true;
  return mode === "rent" ? p.status === "for_rent" : p.status === "for_sale";
}

/** Filter combined activity feed by for_rent vs for_sale. */
export function filterFeedItemsByListingMode(
  items: FeedUnion[],
  mode: ListingMode,
  statusByPropertyId: Record<string, string>,
): FeedUnion[] {
  return items.filter((item) => {
    if (item.kind === "badge_earned" || item.kind === "badge" || item.kind === "viewing_confirmed") {
      return true;
    }
    if (item.kind === "saved_property" || item.kind === "pin_activity") {
      return propertyMatchesListingMode(item.property, mode);
    }
    if (item.kind === "agent") {
      return item.property ? propertyMatchesListingMode(item.property, mode) : true;
    }
    if (item.kind === "price_drop_al" || item.kind === "listing_edited_al") {
      const st = statusByPropertyId[item.propertyId];
      if (!st) return true;
      if (st === "both") return true;
      return mode === "rent" ? st === "for_rent" : st === "for_sale";
    }
    if (item.kind === "followed_agent_listing") {
      return propertyMatchesListingMode(item.property, mode);
    }
    return true;
  });
}

export function filterSavedRowsByMode(rows: SavedJoinRow[], mode: ListingMode): SavedJoinRow[] {
  return rows.filter((r) => propertyMatchesListingMode(oneProperty(r.properties), mode));
}

export function filterLikeRowsByMode(rows: LikeJoinRow[], mode: ListingMode): LikeJoinRow[] {
  return rows.filter((r) => propertyMatchesListingMode(oneProperty(r.properties), mode));
}

export type ClientPrefsRow = {
  budget_min: number | null;
  budget_max: number | null;
  looking_to: string | null;
  preferred_property_type: string | null;
  country_of_origin: string | null;
  preferred_locations: unknown;
  visa_type: string | null;
  visa_expiry: string | null;
  occupant_count: number | null;
  has_pets: boolean | null;
  move_in_timeline: string | null;
  agent_notes: string | null;
};

export function useClientActivityFeed(userId: string | undefined) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [clientPrefs, setClientPrefs] = useState<ClientPrefsRow | null>(null);
  const [badges, setBadges] = useState<{ badge_slug: BadgeSlug; earned_at: string }[]>([]);
  const [savedRows, setSavedRows] = useState<SavedJoinRow[]>([]);
  const [likeRows, setLikeRows] = useState<LikeJoinRow[]>([]);
  const [ownDocs, setOwnDocs] = useState<ClientDocRow[]>([]);
  const [sharedDocs, setSharedDocs] = useState<SharedDocRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [feedItems, setFeedItems] = useState<FeedUnion[]>([]);
  const [feedAgentMeta, setFeedAgentMeta] = useState<
    Record<string, { agentName: string; agentAvatarUrl: string | null; agentId: string | null }>
  >({});
  const [propertyStatusById, setPropertyStatusById] = useState<Record<string, string>>({});


  const loadAll = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      console.warn("[mobile-client-dashboard] auth.getUser() error", authErr);
    }
    const authUid = authData.user?.id ?? null;
    const uid = authUid ?? userId;
    if (authUid && userId && authUid !== userId) {
      console.warn("[mobile-client-dashboard] auth user id does not match context userId; using auth session id for queries", {
        authUserId: authUid,
        contextUserId: userId,
      });
    }

    const [
      profileRes,
      badgesRes,
      savedRes,
      likesRes,
      ownDocsRes,
      sharedRes,
      notifRes,
      feedNotifRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "full_name, avatar_url, created_at, notification_preferences, budget_min, budget_max, looking_to, preferred_property_type, country_of_origin, preferred_locations, visa_type, visa_expiry, occupant_count, has_pets, move_in_timeline, agent_notes",
        )
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("client_badges").select("badge_slug, earned_at").eq("client_id", uid).order("earned_at", { ascending: false }),
      supabase
        .from("saved_properties")
        .select(
          `
          created_at,
          properties (
            id,
            name,
            location,
            price,
            status,
            image_url,
            property_photos (url, sort_order)
          )
        `,
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("property_likes")
        .select(
          `
          property_id,
          created_at,
          properties (
            id,
            name,
            location,
            price,
            status,
            image_url,
            property_photos (url, sort_order)
          )
        `,
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("client_documents")
        .select("id, created_at, document_type, file_url, file_name")
        .eq("client_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("id, created_at, metadata")
        .eq("user_id", uid)
        .eq("type", "document_shared")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).is("read_at", null),
      supabase
        .from("notifications")
        .select("id, created_at, type, title, body, metadata")
        .eq("user_id", uid)
        .in("type", ["client_feed_price_drop", "client_feed_viewing", "viewing_confirmed"])
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    const prow = profileRes.data as {
      full_name?: string | null;
      avatar_url?: string | null;
      created_at?: string;
      notification_preferences?: unknown;
      budget_min?: number | null;
      budget_max?: number | null;
      looking_to?: string | null;
      preferred_property_type?: string | null;
      country_of_origin?: string | null;
      preferred_locations?: unknown;
      visa_type?: string | null;
      visa_expiry?: string | null;
      occupant_count?: number | null;
      has_pets?: boolean | null;
      move_in_timeline?: string | null;
      agent_notes?: string | null;
    } | null;
    if (prow) {
      setFullName(prow.full_name?.trim() ?? "");
      setAvatarUrl(prow.avatar_url?.trim() || null);
      setCreatedAt(prow.created_at ?? null);
      setClientPrefs({
        budget_min: prow.budget_min ?? null,
        budget_max: prow.budget_max ?? null,
        looking_to: prow.looking_to ?? null,
        preferred_property_type: prow.preferred_property_type ?? null,
        country_of_origin: prow.country_of_origin ?? null,
        preferred_locations: prow.preferred_locations ?? null,
        visa_type: prow.visa_type ?? null,
        visa_expiry: prow.visa_expiry ?? null,
        occupant_count: prow.occupant_count ?? null,
        has_pets: prow.has_pets ?? null,
        move_in_timeline: prow.move_in_timeline ?? null,
        agent_notes: prow.agent_notes ?? null,
      });
    } else {
      setCreatedAt(null);
      setClientPrefs(null);
    }

    if (badgesRes.error) {
      console.error("[mobile-client-dashboard] client_badges query error", badgesRes.error);
    }
    const rawBadgeRows = (badgesRes.data ?? []) as { badge_slug: string; earned_at: string }[];
    const normalizedBadges: { badge_slug: BadgeSlug; earned_at: string }[] = [];
    for (const row of rawBadgeRows) {
      const slug = normalizeBadgeSlug(row.badge_slug);
      if (!slug) {
        if ((row.badge_slug ?? "").trim()) {
          console.warn("[mobile-client-dashboard] client_badges row ignored — unknown badge_slug", row.badge_slug);
        }
        continue;
      }
      normalizedBadges.push({ badge_slug: slug, earned_at: row.earned_at });
    }
    console.log("[mobile-client-dashboard] client_badges", {
      clientId: uid,
      rowCount: normalizedBadges.length,
      rows: normalizedBadges,
    });
    setBadges(normalizedBadges);

    setSavedRows((savedRes.data ?? []) as unknown as SavedJoinRow[]);
    setLikeRows((likesRes.data ?? []) as unknown as LikeJoinRow[]);

    setOwnDocs((ownDocsRes.data ?? []) as ClientDocRow[]);

    if (sharedRes.data) {
      const filtered = (sharedRes.data as SharedDocRow[]).filter((r) => {
        const url = r.metadata && typeof r.metadata.signed_url === "string" ? r.metadata.signed_url : "";
        return Boolean(url?.trim());
      });
      setSharedDocs(filtered);
    } else {
      setSharedDocs([]);
    }

    setUnreadCount(typeof notifRes.count === "number" ? notifRes.count : 0);

    const feedRows = (feedNotifRes.data ?? []) as FeedNotificationRow[];
    const savedIdSet = new Set<string>();
    for (const r of (savedRes.data ?? []) as SavedJoinRow[]) {
      const p = oneProperty(r.properties);
      if (p?.id) savedIdSet.add(p.id);
    }

    const profileIdSetEarly = new Set<string>();
    for (const r of (savedRes.data ?? []) as SavedJoinRow[]) {
      const p = oneProperty(r.properties);
      if (p?.id) profileIdSetEarly.add(p.id);
    }
    for (const r of (likesRes.data ?? []) as LikeJoinRow[]) {
      const p = oneProperty(r.properties);
      if (p?.id) profileIdSetEarly.add(p.id);
    }

    const propertyIds = new Set<string>(profileIdSetEarly);
    const agentIds = new Set<string>();
    for (const n of feedRows) {
      const m = n.metadata ?? {};
      const pid = m.property_id;
      if (typeof pid === "string" && pid) propertyIds.add(pid);
      const aid = m.agent_user_id;
      if (typeof aid === "string" && aid) agentIds.add(aid);
    }

    let propMap = new Map<string, PropertyRow>();
    if (propertyIds.size > 0) {
      const { data: props } = await supabase
        .from("properties")
        .select(
          `
          id,
          name,
          location,
          price,
          status,
          image_url,
          property_photos (url, sort_order)
        `,
        )
        .in("id", [...propertyIds]);
      for (const row of (props ?? []) as PropertyRow[]) {
        propMap.set(row.id, row);
      }
    }

    const statusRecord: Record<string, string> = {};
    propMap.forEach((v, k) => {
      statusRecord[k] = v.status;
    });

    let phoneMap = new Map<string, string | null>();
    if (agentIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, phone")
        .in("id", [...agentIds]);
      for (const pr of profs ?? []) {
        const r = pr as { id: string; phone: string | null };
        phoneMap.set(r.id, r.phone);
      }
    }

    const built: FeedUnion[] = [];

    for (const n of feedRows) {
      if (n.type === "viewing_confirmed") {
        built.push({ kind: "viewing_confirmed", sortAt: n.created_at, notification: n });
        continue;
      }
      const m = n.metadata ?? {};
      if (n.type === "client_feed_viewing") {
        const aid = typeof m.agent_user_id === "string" ? m.agent_user_id : "";
        const pid = typeof m.property_id === "string" ? m.property_id : "";
        const prop = pid ? propMap.get(pid) ?? null : null;
        const metaImg = metaStr(m, "property_image_url");
        const img = metaImg || (prop ? pickPropertyImage(prop) : "") || "";
        const priceRaw = prop?.price ?? "";
        const status = prop?.status ?? "for_sale";
        const priceDisplay = formatPropertyPriceDisplay(priceRaw, status);
        const showSavedPill = pid ? savedIdSet.has(pid) : false;
        const phone = aid ? stripPhoneDigits(phoneMap.get(aid) ?? null) : null;
        built.push({
          kind: "agent",
          sortAt: n.created_at,
          notification: n,
          agentPhone: phone,
          property: prop,
          propertyId: pid,
          imageUrl: img,
          priceDisplay,
          showSavedPill,
        });
      } else if (n.type === "client_feed_price_drop") {
        const pidDrop = typeof m.property_id === "string" ? m.property_id : "";
        const propDrop = pidDrop ? propMap.get(pidDrop) : undefined;
        const thumb =
          metaStr(m, "property_image_url") || (propDrop ? pickPropertyImage(propDrop) : "") || "";
        const pName =
          metaStr(m, "property_name")?.trim() ||
          propDrop?.name?.trim() ||
          propDrop?.location?.trim() ||
          "Listing";
        built.push({
          kind: "price_drop_al",
          sortAt: n.created_at,
          id: `notif-${n.id}`,
          propertyId: pidDrop,
          propertyName: pName,
          oldPrice: metaStr(m, "old_price"),
          newPrice: metaStr(m, "new_price"),
          thumbUrl: thumb,
        });
      }
    }

    for (const b of normalizedBadges) {
      built.push({
        kind: "badge_earned",
        sortAt: b.earned_at,
        badge_slug: b.badge_slug,
        earned_at: b.earned_at,
        feedKey: `${b.badge_slug}-${b.earned_at}`,
      });
    }

    const savedDataForFeed = (savedRes.data ?? []) as SavedJoinRow[];
    for (const r of savedDataForFeed) {
      const p = oneProperty(r.properties);
      if (!p?.id) continue;
      built.push({
        kind: "saved_property",
        sortAt: r.created_at,
        property: p,
        created_at: r.created_at,
        saveKey: `${p.id}-${r.created_at}`,
      });
    }

    const likeData = (likesRes.data ?? []) as {
      property_id: string;
      created_at: string;
      properties: PropertyRow | PropertyRow[] | null;
    }[];
    for (const row of likeData) {
      const p = oneProperty(row.properties);
      if (!p?.id) continue;
      built.push({
        kind: "pin_activity",
        sortAt: row.created_at,
        likeKey: `${row.property_id}-${row.created_at}`,
        property: p,
        created_at: row.created_at,
      });
    }

    const pidListForActivity = [...profileIdSetEarly];
    if (pidListForActivity.length > 0) {
      const { data: alRowsPrice } = await supabase
        .from("activity_log")
        .select("id, created_at, entity_id, metadata, action, entity_type")
        .eq("entity_type", "price_drop")
        .in("entity_id", pidListForActivity);
      for (const raw of alRowsPrice ?? []) {
        const row = raw as {
          id: string;
          created_at: string;
          entity_id: string;
          metadata: Record<string, unknown> | null;
        };
        const meta = row.metadata ?? {};
        if (activityLogMetadataIndicatesEngagementOnly(meta)) continue;
        const oldP = metaStr(meta, "old_price");
        const newP = metaStr(meta, "new_price");
        const propRow = propMap.get(row.entity_id);
        const thumb =
          propRow ? pickPropertyImage(propRow) : metaStr(meta, "property_image_url") || "";
        const pName =
          propRow?.name?.trim() || propRow?.location?.trim() || "Listing";
        built.push({
          kind: "price_drop_al",
          sortAt: row.created_at,
          id: row.id,
          propertyId: row.entity_id,
          propertyName: pName,
          oldPrice: oldP,
          newPrice: newP,
          thumbUrl: thumb,
        });
      }

      const { data: alRowsEdited } = await supabase
        .from("activity_log")
        .select("id, created_at, entity_id, metadata, action, entity_type")
        .eq("entity_type", "property")
        .eq("action", "listing_edited")
        .in("entity_id", pidListForActivity);
      for (const raw of alRowsEdited ?? []) {
        const row = raw as {
          id: string;
          created_at: string;
          entity_id: string;
          metadata: Record<string, unknown> | null;
        };
        const meta = row.metadata ?? {};
        if (activityLogMetadataIndicatesEngagementOnly(meta)) continue;
        const propRow = propMap.get(row.entity_id);
        const thumb =
          propRow ? pickPropertyImage(propRow) : metaStr(meta, "property_image_url") || "";
        const pName =
          metaStr(meta, "property_name").trim() ||
          propRow?.name?.trim() ||
          propRow?.location?.trim() ||
          "Listing";
        const editedBy = metaStr(meta, "edited_by_name").trim() || "An agent";
        built.push({
          kind: "listing_edited_al",
          sortAt: row.created_at,
          id: row.id,
          propertyId: row.entity_id,
          propertyName: pName,
          editedByName: editedBy,
          thumbUrl: thumb,
        });
      }
    }

    const { data: followRows } = await supabase.from("agent_followers").select("agent_id").eq("client_id", uid);
    const followedAgentIds = [...new Set((followRows ?? []).map((r) => (r as { agent_id: string }).agent_id))];
    if (followedAgentIds.length > 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: paRowsFollow } = await supabase
        .from("property_agents")
        .select("property_id, agent_id")
        .in("agent_id", followedAgentIds);
      const paList = (paRowsFollow ?? []) as { property_id: string; agent_id: string }[];
      const propIdsFollow = [...new Set(paList.map((r) => r.property_id))];
      if (propIdsFollow.length > 0) {
        const { data: followProps } = await supabase
          .from("properties")
          .select(
            `
            id,
            name,
            location,
            price,
            status,
            image_url,
            created_at,
            property_photos (url, sort_order)
          `,
          )
          .in("id", propIdsFollow)
          .gte("created_at", thirtyDaysAgo)
          .order("created_at", { ascending: false });

        const agentById = new Map<string, { name: string; image_url: string | null }>();
        const { data: agRowsFollow } = await supabase
          .from("agents")
          .select("id, name, image_url")
          .in("id", followedAgentIds);
        for (const a of agRowsFollow ?? []) {
          const r = a as { id: string; name: string; image_url: string | null };
          agentById.set(r.id, { name: r.name, image_url: r.image_url });
        }

        const paByProp = new Map<string, { agent_id: string }[]>();
        for (const row of paList) {
          const list = paByProp.get(row.property_id) ?? [];
          list.push(row);
          paByProp.set(row.property_id, list);
        }

        for (const raw of followProps ?? []) {
          const p = raw as PropertyRow;
          if (!p.id) continue;
          const candidates = paByProp.get(p.id) ?? [];
          const chosen =
            candidates.find((c) => followedAgentIds.includes(c.agent_id)) ?? candidates[0];
          if (!chosen) continue;
          const ag = agentById.get(chosen.agent_id);
          statusRecord[p.id] = p.status;
          built.push({
            kind: "followed_agent_listing",
            sortAt: p.created_at ?? new Date().toISOString(),
            feedKey: `follow-${p.id}-${chosen.agent_id}`,
            property: p,
            agent: {
              id: chosen.agent_id,
              name: ag?.name ?? "Agent",
              image_url: ag?.image_url ?? null,
            },
          });
        }
      }
    }

    setPropertyStatusById(statusRecord);

    built.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
    const dedupedFeed = dedupeListingActivityFeedItems(built);

    const prefs = parseNotifPrefs(
      (profileRes.data as { notification_preferences?: unknown } | null)?.notification_preferences,
    );
    setFeedItems(filterFeedByPrefs(dedupedFeed, prefs));

    const feedPropIds = new Set<string>();
    for (const item of dedupedFeed) {
      if (item.kind === "agent") {
        if (item.propertyId) feedPropIds.add(item.propertyId);
      } else if (item.kind === "price_drop_al" || item.kind === "listing_edited_al") {
        feedPropIds.add(item.propertyId);
      } else if (item.kind === "saved_property") {
        feedPropIds.add(item.property.id);
      } else if (item.kind === "pin_activity") {
        feedPropIds.add(item.property.id);
      } else if (item.kind === "followed_agent_listing") {
        feedPropIds.add(item.property.id);
      }
    }
    if (feedPropIds.size > 0) {
      const { data: feedPa } = await supabase
        .from("property_agents")
        .select(
          `
          property_id,
          agent:agents (
            id,
            name,
            image_url
          )
        `,
        )
        .in("property_id", [...feedPropIds]);
      const fam: Record<string, { agentName: string; agentAvatarUrl: string | null; agentId: string | null }> = {};
      const seen = new Set<string>();
      for (const row of feedPa ?? []) {
        const r = row as {
          property_id: string;
          agent: { id?: string | null; name?: string | null; image_url?: string | null } | null;
        };
        if (seen.has(r.property_id) || !r.agent) continue;
        seen.add(r.property_id);
        fam[r.property_id] = {
          agentId: typeof r.agent.id === "string" && r.agent.id ? r.agent.id : null,
          agentName: r.agent.name?.trim() || "Agent",
          agentAvatarUrl: r.agent.image_url?.trim() || null,
        };
      }
      setFeedAgentMeta(fam);
    } else {
      setFeedAgentMeta({});
    }

    setLoading(false);
  }, [supabase, userId]);


  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const feedGrouped = useMemo(() => {
    const order: TimeBucket[] = ["today", "yesterday", "this_week", "earlier"];
    const groups: Record<TimeBucket, FeedUnion[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      earlier: [],
    };
    for (const item of feedItems) {
      groups[bucketForDate(item.sortAt)].push(item);
    }
    return order
      .filter((k) => groups[k].length > 0)
      .map((k) => ({
        bucket: k,
        label: BUCKET_LABEL[k],
        items: [...groups[k]].sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()),
      }));
  }, [feedItems]);

  return {
    loading,
    setLoading,
    fullName,
    avatarUrl,
    createdAt,
    clientPrefs,
    badges,
    savedRows,
    likeRows,
    ownDocs,
    sharedDocs,
    unreadCount,
    feedItems,
    feedGrouped,
    feedAgentMeta,
    propertyStatusById,
    loadAll,
  };
}

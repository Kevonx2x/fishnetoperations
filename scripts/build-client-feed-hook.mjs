import fs from "fs";

const lines = fs.readFileSync("components/client/mobile-client-dashboard.tsx", "utf8").split(/\r?\n/);
const grab = (a, b) => lines.slice(a - 1, b).join("\n");

const extract = fs.readFileSync("hooks/_extract_load.txt", "utf8");
const fixedLoad = extract
  .replace(/if \(!user\?\.id\)/g, "if (!userId)")
  .replace(/\buser\.id\b/g, "userId")
  .replace(/\[supabase, user\?\.id\]/g, "[supabase, userId]");

const stateBlock = `
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
`;

const out = `"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatPropertyPriceDisplay } from "@/lib/format-listing-price";

${grab(47, 69)}

${grab(71, 84)}

${grab(85, 97)}

${grab(99, 112)}

${grab(289, 294)}

${grab(296, 366)}

${grab(367, 399)}

${grab(408, 416)}

${grab(424, 428)}

${grab(456, 486)}

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
${stateBlock}

${fixedLoad}

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
    loadAll,
  };
}
`;

fs.writeFileSync("hooks/use-client-activity-feed.ts", out);
console.log("Wrote hooks/use-client-activity-feed.ts lines", out.split("\n").length);

import type { Channel as StreamChannel } from "stream-chat";
import { getStreamClient } from "@/lib/stream";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { comparePropertyPhotos } from "@/lib/marketplace-property";
import { cloudinaryPropertyPhotoDisplayUrl } from "@/lib/cloudinary-property-photo-url";

export type BackfillSummary = {
  total: number;
  patched: number;
  skipped: number;
  errors: { channel_id: string; message: string }[];
};

type LeadRow = { property_id: string | null; created_at: string };
type PropertyRow = {
  id: string;
  name: string | null;
  location: string | null;
  price: string | null;
  image_url: string | null;
  property_photos: { url: string | null; sort_order?: number | null; created_at?: string | null }[] | null;
};

type ChannelPropertyMetadata = {
  property_id?: string | null;
  property_name?: string | null;
  property_price?: string | null;
  property_image?: string | null;
};

function getChannelId(ch: StreamChannel): string {
  return (ch.id ?? "").trim() || (ch.cid ?? "").trim() || "unknown";
}

function hasPropertyMetadata(ch: StreamChannel): boolean {
  const data = ch.data as ChannelPropertyMetadata | undefined;
  return Boolean((data?.property_id ?? "").trim());
}

function extractMemberIds(ch: StreamChannel): string[] {
  const members = ch.state?.members ?? {};
  const ids = Object.values(members)
    .map((m) => m.user?.id)
    .filter((x): x is string => Boolean(x && String(x).trim()))
    .map((x) => x.trim());
  return [...new Set(ids)];
}

function pickHeroImage(p: PropertyRow): string {
  const photos = (p.property_photos ?? [])
    .slice()
    .sort(comparePropertyPhotos)
    .map((ph) => String(ph.url || "").trim())
    .filter(Boolean)
    .map((u) => cloudinaryPropertyPhotoDisplayUrl(u));
  if (photos[0]) return photos[0];
  const main = p.image_url?.trim();
  return main ? cloudinaryPropertyPhotoDisplayUrl(main) : "";
}

async function fetchLatestLeadForPair(
  sb: ReturnType<typeof createSupabaseAdmin>,
  agentUserId: string,
  clientUserId: string,
): Promise<LeadRow | null> {
  const { data, error } = await sb
    .from("leads")
    .select("property_id, created_at")
    .eq("agent_id", agentUserId)
    .eq("client_id", clientUserId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  const row = data as unknown as LeadRow | null;
  return row?.created_at ? row : null;
}

async function fetchPropertyById(
  sb: ReturnType<typeof createSupabaseAdmin>,
  propertyId: string,
): Promise<PropertyRow | null> {
  const { data, error } = await sb
    .from("properties")
    .select("id, name, location, price, image_url, property_photos(url, sort_order, created_at)")
    .eq("id", propertyId)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as unknown as PropertyRow | null;
}

async function listAllMessagingChannels(): Promise<StreamChannel[]> {
  const stream = getStreamClient();
  const out: StreamChannel[] = [];
  const limit = 100;
  for (let offset = 0; offset < 10_000; offset += limit) {
    const batch = await stream.queryChannels(
      { type: "messaging" },
      { last_message_at: -1 },
      { limit, offset, state: true, watch: false, presence: false },
    );
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < limit) break;
  }
  return out;
}

/**
 * Backfills `property_*` metadata onto Stream messaging channels that are missing it.
 * Metadata is derived from the latest Supabase lead for the agent+client member pair.
 *
 * Idempotent: already-patched channels are skipped.
 */
export async function backfillStreamChannelPropertyMetadata(): Promise<BackfillSummary> {
  const sb = createSupabaseAdmin();
  const stream = getStreamClient();

  const channels = await listAllMessagingChannels();
  let patched = 0;
  let skipped = 0;
  const errors: BackfillSummary["errors"] = [];

  for (const ch of channels) {
    const channelId = getChannelId(ch);
    try {
      if (hasPropertyMetadata(ch)) {
        skipped += 1;
        console.log("[stream/backfill] skip (already has property_id)", channelId);
        continue;
      }

      const members = extractMemberIds(ch);
      if (members.length !== 2) {
        skipped += 1;
        console.log("[stream/backfill] skip (unexpected members)", channelId, members);
        continue;
      }

      const [a, b] = members;
      if (!a || !b) {
        skipped += 1;
        console.log("[stream/backfill] skip (missing member ids)", channelId);
        continue;
      }

      // Leads store agent in `agent_id` and client in `client_id`. We don't know which member is which,
      // so query both ways and pick the newer one.
      const [lead1, lead2] = await Promise.all([fetchLatestLeadForPair(sb, a, b), fetchLatestLeadForPair(sb, b, a)]);
      const latest =
        lead1 && lead2
          ? new Date(lead1.created_at).getTime() >= new Date(lead2.created_at).getTime()
            ? lead1
            : lead2
          : lead1 ?? lead2;

      const propertyId = (latest?.property_id ?? "").trim();
      if (!propertyId) {
        skipped += 1;
        console.log("[stream/backfill] skip (no lead/property)", channelId);
        continue;
      }

      const prop = await fetchPropertyById(sb, propertyId);
      if (!prop?.id) {
        skipped += 1;
        console.log("[stream/backfill] skip (property not found)", channelId, propertyId);
        continue;
      }

      const set: ChannelPropertyMetadata = {
        property_id: prop.id,
        property_name: (prop.name ?? prop.location ?? "").trim() || null,
        property_price: (prop.price ?? "").trim() || null,
        property_image: pickHeroImage(prop) || null,
      };

      await stream.channel("messaging", channelId).updatePartial({ set: set as Record<string, unknown> });
      patched += 1;
      console.log("[stream/backfill] patched", channelId, set.property_id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ channel_id: channelId, message: msg });
      console.warn("[stream/backfill] error", channelId, msg);
    }
  }

  return { total: channels.length, patched, skipped, errors };
}


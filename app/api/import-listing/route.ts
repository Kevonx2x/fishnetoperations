import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  callAnthropicListingJson,
  computeSourceHash,
  scrapeListingPage,
  uploadRemoteImageToCloudinary,
  type AnthropicListingJson,
} from "@/lib/import-listing-server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "broker" && session.role !== "admin") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  let body: { url?: unknown; text?: unknown };
  try {
    body = (await req.json()) as { url?: unknown; text?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pasteText = typeof body.text === "string" ? body.text.trim() : "";
  const urlRaw = typeof body.url === "string" ? body.url.trim() : "";

  if (pasteText && !urlRaw) {
    if (pasteText.length < 20) {
      return Response.json({ error: "text must be at least 20 characters" }, { status: 400 });
    }
    try {
      const ai = await callAnthropicListingJson(pasteText);
      const data = buildResponseData(ai, [], null, null);
      return Response.json({ duplicate: false, data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      return Response.json({ error: msg }, { status: 502 });
    }
  }

  if (!urlRaw) {
    return Response.json({ error: "url or text is required" }, { status: 400 });
  }

  let pageUrl: URL;
  try {
    pageUrl = new URL(urlRaw);
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  const canonicalUrl = pageUrl.href;

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  const { data: dupByUrl } = await admin.from("properties").select("id").eq("source_url", canonicalUrl).maybeSingle();
  if (dupByUrl?.id) {
    return Response.json({ duplicate: true, property_id: dupByUrl.id as string });
  }

  let scraped;
  try {
    scraped = await scrapeListingPage(canonicalUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to scrape page";
    return Response.json({ error: msg }, { status: 502 });
  }

  const preHash = computeSourceHash(
    scraped.title,
    scraped.price || "0",
    scraped.location || "",
  );
  const { data: dupByHash } = await admin.from("properties").select("id").eq("source_hash", preHash).maybeSingle();
  if (dupByHash?.id) {
    return Response.json({ duplicate: true, property_id: dupByHash.id as string });
  }

  const cloudinaryUrls: string[] = [];
  for (const imgUrl of scraped.imageUrls.slice(0, 5)) {
    try {
      const up = await uploadRemoteImageToCloudinary(imgUrl);
      cloudinaryUrls.push(up.url);
    } catch {
      /* skip broken images */
    }
  }

  const rawForAi = [
    scraped.title,
    scraped.price ? `Price hint: ${scraped.price}` : "",
    scraped.location ? `Location hint: ${scraped.location}` : "",
    scraped.description,
  ]
    .filter(Boolean)
    .join("\n\n");

  let ai: AnthropicListingJson;
  try {
    ai = await callAnthropicListingJson(rawForAi || scraped.description, {
      scraped,
      sourceUrl: canonicalUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI analysis failed";
    return Response.json({ error: msg }, { status: 502 });
  }

  const sourceHash = computeSourceHash(
    (ai.title ?? scraped.title).trim(),
    String(ai.price ?? scraped.price ?? "0"),
    (ai.location ?? scraped.location ?? "").trim(),
  );

  const { data: dupFinal } = await admin.from("properties").select("id").eq("source_hash", sourceHash).maybeSingle();
  if (dupFinal?.id) {
    return Response.json({ duplicate: true, property_id: dupFinal.id as string });
  }

  const data = buildResponseData(ai, cloudinaryUrls, canonicalUrl, sourceHash);
  return Response.json({ duplicate: false, data });
}

function buildResponseData(
  ai: AnthropicListingJson,
  images: string[],
  source_url: string | null,
  source_hash: string | null,
) {
  return {
    title: ai.title ?? null,
    description: ai.description ?? null,
    property_type: ai.property_type ?? null,
    price: typeof ai.price === "number" && Number.isFinite(ai.price) ? ai.price : null,
    bedrooms: typeof ai.bedrooms === "number" && Number.isFinite(ai.bedrooms) ? ai.bedrooms : null,
    bathrooms: typeof ai.bathrooms === "number" && Number.isFinite(ai.bathrooms) ? ai.bathrooms : null,
    floor_area: typeof ai.floor_area === "number" && Number.isFinite(ai.floor_area) ? ai.floor_area : null,
    lot_area: typeof ai.lot_area === "number" && Number.isFinite(ai.lot_area) ? ai.lot_area : null,
    location: ai.location ?? null,
    images,
    source_url,
    source_hash,
  };
}

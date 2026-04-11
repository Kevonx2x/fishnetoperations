import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function computeSourceHash(title: string, price: string, location: string): string {
  const n = `${title.trim().toLowerCase()}|${String(price).trim()}|${location.trim().toLowerCase()}`;
  return createHash("sha256").update(n).digest("hex");
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number.parseInt(n, 10)));
}

function extractMeta(html: string, prop: string): string | null {
  const p = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let m = html.match(
    new RegExp(`<meta[^>]+property=["']${p}["'][^>]+content=["']([^"']+)["']`, "i"),
  );
  if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  m = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${p}["']`, "i"),
  );
  if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  return null;
}

function extractNameMeta(html: string, name: string): string | null {
  const p = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let m = html.match(
    new RegExp(`<meta[^>]+name=["']${p}["'][^>]+content=["']([^"']+)["']`, "i"),
  );
  if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  m = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${p}["']`, "i"),
  );
  if (m?.[1]) return decodeHtmlEntities(m[1].trim());
  return null;
}

function extractOgImages(html: string): string[] {
  const out: string[] = [];
  const re2 = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re2.exec(html)) !== null) {
    if (m[1]) out.push(decodeHtmlEntities(m[1].trim()));
  }
  return [...new Set(out)];
}

function extractImgUrls(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return out;
  }
  const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const src = m[1]?.trim() ?? "";
    if (!src) continue;
    const low = src.toLowerCase();
    if (!low.includes("property") && !low.includes("listing")) continue;
    try {
      const abs = new URL(src, base).href;
      if (abs.startsWith("http")) out.push(abs);
    } catch {
      /* skip */
    }
  }
  return [...new Set(out)];
}

function extractJsonLdBlocks(html: string): string[] {
  const out: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1]?.trim()) out.push(m[1].trim());
  }
  return out;
}

function tryPriceFromJsonLd(blocks: string[]): string | null {
  for (const raw of blocks) {
    try {
      const j = JSON.parse(raw) as unknown;
      const stack: unknown[] = [j];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        if (Array.isArray(cur)) {
          for (const x of cur) stack.push(x);
          continue;
        }
        const o = cur as Record<string, unknown>;
        if (typeof o.offers === "object" && o.offers) stack.push(o.offers);
        if (typeof o.price === "number") return String(o.price);
        if (typeof o.price === "string" && /\d/.test(o.price)) return o.price;
        if (typeof o.lowPrice === "number") return String(o.lowPrice);
        for (const v of Object.values(o)) {
          if (v && typeof v === "object") stack.push(v);
        }
      }
    } catch {
      /* skip */
    }
  }
  return null;
}

function extractPriceLoose(html: string): string | null {
  const patterns = [
    /₱\s*[\d,]+(?:\.\d+)?/,
    /PHP\s*[\d,]+(?:\.\d+)?/i,
    /"price"\s*:\s*"?([\d,]+)/i,
    /price["']?\s*[:=]\s*["']?([\d,]+)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[0]) return m[0].replace(/\s+/g, " ").trim();
  }
  return null;
}

function extractBedBath(html: string): { beds: string | null; baths: string | null } {
  let beds: string | null = null;
  let baths: string | null = null;
  const bedM = html.match(/(\d+)\s*(?:bed|bedroom|br)\b/i);
  if (bedM?.[1]) beds = bedM[1];
  const bathM = html.match(/(\d+)\s*(?:bath|bathroom)\b/i);
  if (bathM?.[1]) baths = bathM[1];
  return { beds, baths };
}

function extractSqm(html: string): string | null {
  const m = html.match(/([\d,.]+)\s*(?:sqm|m²|m2)\b/i);
  if (m?.[1]) return m[1].replace(/,/g, "");
  const f = html.match(/([\d,.]+)\s*(?:sqft|sq\.?\s*ft)\b/i);
  if (f?.[1]) return f[1].replace(/,/g, "");
  return null;
}

export type ScrapedListing = {
  title: string;
  description: string;
  location: string;
  price: string;
  beds: string;
  baths: string;
  floorArea: string;
  lotArea: string;
  propertyTypeHint: string;
  imageUrls: string[];
  rawHtmlSample: string;
};

export async function scrapeListingPage(url: string): Promise<ScrapedListing> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch page (${res.status})`);
  }
  const html = await res.text();
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  let title =
    extractMeta(html, "og:title") ||
    extractNameMeta(html, "twitter:title") ||
    (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "").trim();
  title = decodeHtmlEntities(title);

  let description =
    extractMeta(html, "og:description") ||
    extractNameMeta(html, "description") ||
    "";

  const jsonLd = extractJsonLdBlocks(html);
  const priceFromLd = tryPriceFromJsonLd(jsonLd);
  let price = priceFromLd || extractPriceLoose(html) || "";

  const loc =
    extractMeta(html, "og:locality") ||
    extractMeta(html, "og:region") ||
    extractNameMeta(html, "geo.region") ||
    "";

  let location = loc;
  if (host.includes("lamudi")) {
    const m = html.match(/"addressLocality"\s*:\s*"([^"]+)"/);
    if (m?.[1]) location = `${m[1]}, Philippines`;
  }
  if (host.includes("propertyguru")) {
    const m = html.match(/propertyguru[^"]*location[^"]*"([^"]+)"/i);
    if (m?.[1]) location = decodeHtmlEntities(m[1]);
  }
  if (host.includes("dotproperty") || host.includes("dot-property")) {
    const m = html.match(/"address":\s*"([^"]+)"/i);
    if (m?.[1]) location = decodeHtmlEntities(m[1]);
  }

  const { beds, baths } = extractBedBath(html);
  const floor = extractSqm(html);
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const bodyText = stripped
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
  if (!description && bodyText) description = bodyText.slice(0, 2000);

  const ogImages = extractOgImages(html);
  const imgHits = extractImgUrls(html, url);
  const imageUrls = [...new Set([...ogImages, ...imgHits])].slice(0, 12);

  const typeHint =
    (html.match(/\b(condo|condominium|house|townhouse|villa|apartment|land|commercial|studio)\b/i)?.[1] ??
      "property").toLowerCase();

  return {
    title: title || "Imported listing",
    description: description || bodyText.slice(0, 4000),
    location: location || "",
    price,
    beds: beds || "",
    baths: baths || "",
    floorArea: floor || "",
    lotArea: "",
    propertyTypeHint: typeHint,
    imageUrls,
    rawHtmlSample: html.slice(0, 25_000),
  };
}

function configureCloudinary(): { ok: true } | { error: string } {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    return { error: "Cloudinary is not configured" };
  }
  cloudinary.config({ cloud_name, api_key, api_secret });
  return { ok: true };
}

export async function uploadRemoteImageToCloudinary(imageUrl: string): Promise<{ url: string; public_id: string }> {
  const cfg = configureCloudinary();
  if (!("ok" in cfg && cfg.ok)) {
    throw new Error("cloudinary");
  }
  const res = await fetch(imageUrl, {
    headers: { "User-Agent": BROWSER_UA, Accept: "image/*,*/*;q=0.8" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`image fetch ${res.status}`);
  const mime = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!IMAGE_MIME.has(mime)) {
    throw new Error("not an image");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 12 * 1024 * 1024) throw new Error("image too large");

  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "bahaygo/properties",
        resource_type: "image",
        transformation: [
          { width: 1200, crop: "limit", quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) reject(error);
        else if (result?.secure_url && result.public_id) {
          resolve({ secure_url: result.secure_url, public_id: result.public_id });
        } else {
          reject(new Error("Upload returned no URL"));
        }
      },
    );
    Readable.from(buf).pipe(uploadStream);
  }).then((r) => ({ url: r.secure_url, public_id: r.public_id }));
}

const ANTHROPIC_MODEL = "claude-opus-4-5";

export type AnthropicListingJson = {
  title?: string;
  description?: string;
  property_type?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor_area?: number;
  lot_area?: number;
  location?: string;
};

export async function callAnthropicListingJson(
  rawDescription: string,
  context?: { scraped?: ScrapedListing; sourceUrl?: string },
): Promise<AnthropicListingJson> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const scrapeBlock =
    context?.scraped != null
      ? `Scraped hints (may be incomplete):
Title: ${context.scraped.title}
Price hint: ${context.scraped.price}
Location hint: ${context.scraped.location}
Beds/Baths hints: ${context.scraped.beds} / ${context.scraped.baths}
Floor area hint: ${context.scraped.floorArea}
Property type hint: ${context.scraped.propertyTypeHint}
Source URL: ${context.sourceUrl ?? ""}
`
      : "";

  const prompt = `${scrapeBlock}
Raw listing text / description (primary source):
${rawDescription.slice(0, 24_000)}

Return ONLY a JSON object with these exact keys (use null only if truly unknown):
{
  "title": "string",
  "description": "string — clean professional property listing description for buyers",
  "property_type": "one of: House, Condo, Apartment, Studio, Commercial, Villa, Townhouse, Land, Presale",
  "price": number (total price in PHP for sale, or monthly rent in PHP for rent),
  "bedrooms": number,
  "bathrooms": number,
  "floor_area": number (floor area in square meters if possible, else approximate),
  "lot_area": number or null,
  "location": "string — area, city, Philippines"
}
No markdown, no explanation — ONLY the JSON object.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic error ${res.status}: ${t.slice(0, 300)}`);
  }

  const raw = (await res.json()) as { content?: { type: string; text?: string }[] };
  const block = raw.content?.find((c) => c.type === "text");
  const rawText = block?.text?.trim() ?? "";
  let jsonStr = rawText;
  const fence = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) jsonStr = fence[1].trim();
  else {
    const brace = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    if (brace >= 0 && end > brace) jsonStr = rawText.slice(brace, end + 1);
  }

  const parsed = JSON.parse(jsonStr) as AnthropicListingJson;
  return parsed;
}

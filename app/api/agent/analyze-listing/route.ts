import { getSessionProfile } from "@/lib/admin-api-auth";

type AnthropicContent = { type: string; text?: string };

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "agent" && session.role !== "broker" && session.role !== "admin") {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 20_000) {
    return Response.json({ error: "text is required (max 20000 chars)" }, { status: 400 });
  }

  const prompt = `Extract real estate listing details from this text and return ONLY a JSON object with these exact fields:
{
  "name": "property title",
  "price": number (monthly if rent, total if sale),
  "listing_type": "rent" or "sale",
  "property_type": "condo" or "house" or "apartment" or "townhouse" or "commercial" or "land" or "presale",
  "beds": number,
  "baths": number,
  "sqft": number,
  "location": "city/area name",
  "description": "clean formatted description with these sections:
OVERVIEW
[2-3 sentence summary]

PROPERTY DETAILS
• X bedrooms, X bathrooms
• X sqm / X sqft
• [furnished status]
• [floor level if mentioned]

LOCATION
[location details, nearby landmarks]

AMENITIES
[bullet list of amenities if mentioned]

TERMS
[price, lease terms if mentioned]",
  "is_presale": false,
  "developer_name": null,
  "turnover_date": null
}

Text:
${text}

Return ONLY the JSON, no other text.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return Response.json(
      { error: `Anthropic API error: ${res.status}`, detail: errText.slice(0, 500) },
      { status: 502 },
    );
  }

  const raw = (await res.json()) as {
    content?: AnthropicContent[];
  };
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

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Could not parse listing JSON from model response" }, { status: 502 });
  }

  return Response.json({ data: parsed });
}

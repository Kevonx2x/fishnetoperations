import type { PropertySummary } from "@/app/api/properties/[id]/summary/route";

const PROPERTY_SUMMARY_ENDPOINT_PREFIX = "/api/properties/";

export type { PropertySummary };

export type PropertySummaryResult =
  | { ok: true; data: PropertySummary }
  | { ok: false; error: string };

/**
 * Fetches a minimal property summary for UI surfaces like messaging context panels.
 * Returns a structured result instead of throwing to keep components clean.
 */
export async function fetchPropertySummary(
  propertyId: string,
  opts?: { signal?: AbortSignal },
): Promise<PropertySummaryResult> {
  const id = propertyId.trim();
  if (!id) return { ok: false, error: "Missing property id" };

  const res = await fetch(`${PROPERTY_SUMMARY_ENDPOINT_PREFIX}${encodeURIComponent(id)}/summary`, {
    method: "GET",
    credentials: "include",
    signal: opts?.signal,
  });

  const json = (await res.json().catch(() => null)) as
    | { success: true; data: PropertySummary }
    | { success: false; error?: { message?: string } }
    | null;

  if (!res.ok || !json || json.success !== true) {
    const msg =
      json && "success" in json && json.success === false
        ? json.error?.message ?? "Could not load property"
        : "Could not load property";
    return { ok: false, error: msg };
  }

  return { ok: true, data: json.data };
}


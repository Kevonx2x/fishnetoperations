import { NextRequest } from "next/server";
import {
  matchRunSchema,
  savedSearchFiltersSchema,
} from "@/lib/api/schemas/phase1";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { propertyMatchesFilters, scorePropertyMatch } from "@/lib/property-match";
import type { PropertyRow } from "@/lib/property-match";
import { logActivity } from "@/lib/activity-log";
import { createSupabaseUserClient } from "@/lib/supabase-route";
import { publicListingExpiryOrFilter } from "@/lib/listing-expiry-public-filter";
import { hideTutorialDemoPropertiesOrFilter } from "@/lib/tutorial-demo-property-filter";

/**
 * Evaluates saved searches against all properties and inserts property_matches + notifications (DB trigger).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseUserClient(request);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return fail("UNAUTHORIZED", "Bearer token required", 401);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = matchRunSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    let searchesQuery = supabase
      .from("saved_searches")
      .select("id, filters, user_id")
      .eq("user_id", userData.user.id)
      .eq("alert_enabled", true);

    if (parsed.data.saved_search_id) {
      searchesQuery = searchesQuery.eq("id", parsed.data.saved_search_id);
    }

    const { data: searches, error: seErr } = await searchesQuery;
    if (seErr) return fail("DATABASE_ERROR", seErr.message, 500);

    const { data: properties, error: pErr } = await supabase
      .from("properties")
      .select("id, location, price, sqft, beds, baths, image_url")
      .or(publicListingExpiryOrFilter())
      .or(hideTutorialDemoPropertiesOrFilter())
      .is("deleted_at", null)
      .eq("availability_state", "available");

    if (pErr) return fail("DATABASE_ERROR", pErr.message, 500);

    const props = (properties ?? []) as PropertyRow[];
    let inserted = 0;

    for (const search of searches ?? []) {
      const parsedFilters = savedSearchFiltersSchema.safeParse(search.filters);
      if (!parsedFilters.success) continue;
      const filters = parsedFilters.data;

      for (const p of props) {
        if (!propertyMatchesFilters(p, filters)) continue;
        const score = scorePropertyMatch(p, filters);
        const { error: insErr } = await supabase.from("property_matches").insert({
          saved_search_id: search.id,
          property_id: p.id,
          match_score: Math.round(score * 1000) / 1000,
        });
        if (!insErr) inserted++;
        else if (insErr.code !== "23505") {
          return fail("DATABASE_ERROR", insErr.message, 500);
        }
      }

      await supabase
        .from("saved_searches")
        .update({ last_matched_at: new Date().toISOString() })
        .eq("id", search.id);
    }

    await logActivity(supabase, {
      actor_id: userData.user.id,
      action: "match.run",
      entity_type: "saved_search",
      metadata: { matches_inserted: inserted, searches: (searches ?? []).length },
    }).catch(() => {});

    return ok({
      searches_scanned: (searches ?? []).length,
      properties_compared: props.length,
      matches_inserted: inserted,
    });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

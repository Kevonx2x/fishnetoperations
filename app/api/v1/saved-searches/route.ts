import { NextRequest } from "next/server";
import { createSavedSearchSchema } from "@/lib/api/schemas/phase1";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { logActivity } from "@/lib/activity-log";
import { createSupabaseUserClient } from "@/lib/supabase-route";

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseUserClient(request);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return fail("UNAUTHORIZED", "Bearer token required", 401);
    }

    const { data, error } = await supabase
      .from("saved_searches")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return fail("DATABASE_ERROR", error.message, 500);
    return ok(data ?? []);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseUserClient(request);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return fail("UNAUTHORIZED", "Bearer token required", 401);
    }

    const body = await request.json();
    const parsed = createSavedSearchSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const { data, error } = await supabase
      .from("saved_searches")
      .insert({
        user_id: userData.user.id,
        name: parsed.data.name,
        filters: parsed.data.filters,
        alert_enabled: parsed.data.alert_enabled,
      })
      .select()
      .single();

    if (error) return fail("DATABASE_ERROR", error.message, 500);

    await logActivity(supabase, {
      actor_id: userData.user.id,
      action: "saved_search.create",
      entity_type: "saved_search",
      entity_id: data.id,
    }).catch(() => {});

    return ok(data, 201);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

import { NextRequest } from "next/server";
import { createLeadSchema } from "@/lib/api/schemas/phase1";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { isAdminPanelRole } from "@/lib/auth-roles";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/activity-log";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";

/** Public lead capture + admin/staff listing */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createLeadSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const { url, anonKey: anon } = getPublicSupabaseEnv();
    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const row = parsed.data;
    const { data, error } = await supabase
      .from("leads")
      .insert({
        name: row.name,
        email: row.email,
        phone: row.phone ?? null,
        property_interest: row.property_interest ?? null,
        message: row.message ?? null,
        source: row.source,
        stage: row.stage,
        agent_id: row.agent_id,
        broker_id: row.broker_id,
        client_id: row.client_id,
      })
      .select("id")
      .single();

    if (error) {
      return fail("DATABASE_ERROR", error.message, 500);
    }

    return ok({ id: data.id }, 201);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

export async function GET() {
  try {
    const session = await getSessionProfile();
    if (!session) {
      return fail("UNAUTHORIZED", "Sign in to list leads", 401);
    }

    if (isAdminPanelRole(session.role)) {
      const adminSb = createSupabaseAdmin();
      const { data, error } = await adminSb
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return fail("DATABASE_ERROR", error.message, 500);
      return ok(data ?? []);
    }

    const sb = await createSupabaseServerClient();
    const { data, error } = await sb
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return fail("DATABASE_ERROR", error.message, 500);

    await logActivity(sb, {
      actor_id: session.userId,
      action: "leads.list",
      entity_type: "lead",
      metadata: { count: data?.length ?? 0 },
    }).catch(() => {});

    return ok(data ?? []);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

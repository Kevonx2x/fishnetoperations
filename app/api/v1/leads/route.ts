import { NextRequest } from "next/server";
import { createLeadSchema } from "@/lib/api/schemas/phase1";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { verifyAdminApiRequest } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/activity-log";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseUserClient } from "@/lib/supabase-route";
import { createClient } from "@supabase/supabase-js";

/** Public lead capture + admin/staff listing */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createLeadSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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

export async function GET(request: NextRequest) {
  try {
    const admin = verifyAdminApiRequest(request);
    const userClient = createSupabaseUserClient(request);
    const { data: userData } = await userClient.auth.getUser();

    if (admin) {
      const adminSb = createSupabaseAdmin();
      const { data, error } = await adminSb
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return fail("DATABASE_ERROR", error.message, 500);
      return ok(data ?? []);
    }

    if (!userData.user) {
      return fail("UNAUTHORIZED", "Sign in or provide x-admin-password", 401);
    }

    const { data, error } = await userClient
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return fail("DATABASE_ERROR", error.message, 500);

    await logActivity(userClient, {
      actor_id: userData.user.id,
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

import { NextRequest } from "next/server";
import { notifyAdminNewAgentRegistered } from "@/lib/admin-notify-sms";
import { registerAgentSchema } from "@/lib/api/schemas/phase1-batch2";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseUserClient } from "@/lib/supabase-route";

export async function POST(request: NextRequest) {
  try {
    const fromCookies = await createSupabaseServerClient();
    const { data: cookieAuth } = await fromCookies.auth.getUser();
    const supabase = cookieAuth.user
      ? fromCookies
      : createSupabaseUserClient(request);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return fail("UNAUTHORIZED", "Sign in to register as an agent", 401);
    }

    const body = await request.json();
    const parsed = registerAgentSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const { data: existing } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (existing) {
      return fail("CONFLICT", "You already have an agent registration", 409);
    }

    const { data: existingBroker } = await supabase
      .from("brokers")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (existingBroker) {
      return fail(
        "CONFLICT",
        "This account is already registered as a broker. Use a separate account for an agent profile.",
        409,
      );
    }

    const brokerId = parsed.data.broker_id?.trim() || null;
    if (brokerId) {
      const { data: broker } = await supabase
        .from("brokers")
        .select("id")
        .eq("id", brokerId)
        .eq("status", "approved")
        .eq("verified", true)
        .maybeSingle();
      if (!broker) {
        return fail(
          "VALIDATION_ERROR",
          "Selected brokerage is invalid or not yet approved",
          422,
          undefined,
          "broker_id",
        );
      }
    }

    const emailTrim = parsed.data.email.trim();
    const nameTrim = parsed.data.name.trim();

    const { data: existingProfile, error: profErr } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profErr) {
      return fail("DATABASE_ERROR", profErr.message, 500);
    }
    const existingFullName = String((existingProfile as { full_name?: string | null } | null)?.full_name ?? "").trim();
    const existingAvatar = String((existingProfile as { avatar_url?: string | null } | null)?.avatar_url ?? "").trim();

    // If the user already has a client profile with identity fields set, do not overwrite them.
    if (!(existingFullName && existingAvatar)) {
      const { error: profileErr } = await supabase.rpc("ensure_agent_profile", {
        p_id: userData.user.id,
        p_email: emailTrim,
        p_full_name: nameTrim,
      });
      if (profileErr) {
        return fail("DATABASE_ERROR", profileErr.message, 500);
      }
    }

    const row = {
      user_id: userData.user.id,
      name: existingFullName || nameTrim,
      license_number: parsed.data.license_number,
      license_expiry: parsed.data.license_expiry?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      email: emailTrim,
      bio: parsed.data.bio?.trim() || null,
      broker_id: brokerId,
      prc_document_url: parsed.data.prc_document_url,
      selfie_url: parsed.data.selfie_url,
      verification_status: "pending" as const,
    };

    const { data, error } = await supabase
      .from("agents")
      .insert(row)
      .select()
      .single();

    if (error) {
      return fail("DATABASE_ERROR", error.message, 500);
    }

    try {
      await notifyAdminNewAgentRegistered({
        name: nameTrim,
        email: emailTrim,
        license: parsed.data.license_number,
      });
    } catch (e) {
      console.error("[register/agent] admin SMS", e);
    }

    return ok(data);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

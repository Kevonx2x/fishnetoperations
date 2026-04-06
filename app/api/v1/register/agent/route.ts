import { NextRequest } from "next/server";
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
        );
      }
    }

    const emailTrim = parsed.data.email.trim();
    const nameTrim = parsed.data.name.trim();

    const { error: profileErr } = await supabase.rpc("ensure_agent_profile", {
      p_id: userData.user.id,
      p_email: emailTrim,
      p_full_name: nameTrim,
    });
    if (profileErr) {
      return fail("DATABASE_ERROR", profileErr.message, 500);
    }

    const row = {
      user_id: userData.user.id,
      name: nameTrim,
      license_number: parsed.data.license_number,
      license_expiry: parsed.data.license_expiry?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      email: emailTrim,
      bio: parsed.data.bio?.trim() || null,
      broker_id: brokerId,
    };

    const { data, error } = await supabase
      .from("agents")
      .insert(row)
      .select()
      .single();

    if (error) {
      return fail("DATABASE_ERROR", error.message, 500);
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

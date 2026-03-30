import { NextRequest } from "next/server";
import { registerBrokerSchema } from "@/lib/api/schemas/phase1-batch2";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { createSupabaseUserClient } from "@/lib/supabase-route";

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseUserClient(request);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return fail("UNAUTHORIZED", "Sign in to register as a broker", 401);
    }

    const body = await request.json();
    const parsed = registerBrokerSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const { data: existing } = await supabase
      .from("brokers")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (existing) {
      return fail("CONFLICT", "You already have a broker registration", 409);
    }

    const { data: existingAgent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (existingAgent) {
      return fail(
        "CONFLICT",
        "This account is already registered as an agent. Use a separate account for a brokerage.",
        409,
      );
    }

    const row = {
      user_id: userData.user.id,
      name: parsed.data.name,
      company_name: parsed.data.company_name,
      license_number: parsed.data.license_number,
      license_expiry: parsed.data.license_expiry?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      email: parsed.data.email.trim(),
      website: parsed.data.website?.trim() || null,
      logo_url: parsed.data.logo_url?.trim() || null,
      bio: parsed.data.bio?.trim() || null,
    };

    const { data, error } = await supabase
      .from("brokers")
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

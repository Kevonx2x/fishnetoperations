import { NextRequest } from "next/server";
import { notifyAdminNewAgentRegistered } from "@/lib/admin-notify-sms";
import { registerAgentSchema } from "@/lib/api/schemas/phase1-batch2";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_AGENT_BIO_TAGLINE,
  DEFAULT_AGENT_LANGUAGES_COMMAS,
  DEFAULT_AGENT_SPECIALTIES_COMMAS,
} from "@/lib/agent-profile-defaults";
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

    const { data: existingAgency } = await supabase
      .from("agencies")
      .select("id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (existingAgency) {
      return fail(
        "CONFLICT",
        "This account is already registered as an agency. Use a separate account for an agent profile.",
        409,
      );
    }

    const agenciesInput = Array.isArray(parsed.data.agencies) ? parsed.data.agencies : null;
    const legacyAgencyId = parsed.data.agency_id?.trim() || null;
    const agencies =
      agenciesInput && agenciesInput.length
        ? agenciesInput
        : legacyAgencyId
          ? [{ agency_id: legacyAgencyId, is_primary: true }]
          : [];

    const normalizedAgencies = (() => {
      const seen = new Set<string>();
      const out: { agency_id: string; is_primary: boolean }[] = [];
      for (const b of agencies) {
        const id = b.agency_id.trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ agency_id: id, is_primary: Boolean(b.is_primary) });
      }
      let primaryIdx = out.findIndex((x) => x.is_primary);
      if (primaryIdx < 0 && out.length > 0) primaryIdx = 0;
      return out.map((x, idx) => ({ ...x, is_primary: primaryIdx >= 0 ? idx === primaryIdx : false }));
    })();

    if (normalizedAgencies.length) {
      const ids = normalizedAgencies.map((b) => b.agency_id);
      const { data: rows, error: bErr } = await supabase
        .from("agencies")
        .select("id")
        .in("id", ids)
        .eq("status", "approved")
        .eq("verified", true);
      if (bErr) return fail("DATABASE_ERROR", bErr.message, 500);
      const okIds = new Set((rows ?? []).map((r) => String((r as { id?: string }).id ?? "")));
      const bad = ids.find((id) => !okIds.has(id));
      if (bad) {
        return fail(
          "VALIDATION_ERROR",
          "Selected agency is invalid or not yet approved",
          422,
          undefined,
          "agency_id",
        );
      }
    }

    const primaryAgencyId =
      normalizedAgencies.find((b) => b.is_primary)?.agency_id ??
      normalizedAgencies[0]?.agency_id ??
      null;

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
      bio: parsed.data.bio?.trim() || DEFAULT_AGENT_BIO_TAGLINE,
      languages_spoken: DEFAULT_AGENT_LANGUAGES_COMMAS,
      specialties: DEFAULT_AGENT_SPECIALTIES_COMMAS,
      agency_id: primaryAgencyId,
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

    if (normalizedAgencies.length) {
      const agentId = String((data as { id?: string }).id ?? "");
      if (agentId) {
        await supabase.from("agent_agencies").delete().eq("agent_id", agentId);
        const payload = normalizedAgencies.map((b) => ({
          agent_id: agentId,
          agency_id: b.agency_id,
          is_primary: b.is_primary,
        }));
        const { error: abErr } = await supabase.from("agent_agencies").insert(payload);
        if (abErr) return fail("DATABASE_ERROR", abErr.message, 500);
      }
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

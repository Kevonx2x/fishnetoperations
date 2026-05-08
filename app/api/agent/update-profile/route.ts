import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TAGLINE_MAX = 40;

const bodySchema = z.object({
  agentId: z.string().min(1),
  patch: z
    .object({
      bio: z.union([z.string().max(TAGLINE_MAX), z.null()]).optional(),
      brokers: z
        .array(
          z
            .object({
              broker_id: z.string().uuid(),
              is_primary: z.boolean().optional().default(false),
            })
            .strict(),
        )
        .max(10)
        .optional(),
    })
    .strict(),
});

export async function POST(req: Request) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) return fail("UNAUTHORIZED", "Sign in required", 401);

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fromZodError(parsed.error);

    const { agentId, patch } = parsed.data;
    const sb = await createSupabaseServerClient();

    const { data: agent, error: aErr } = await sb
      .from("agents")
      .select("id, user_id")
      .eq("id", agentId)
      .maybeSingle();
    if (aErr) return fail("DATABASE_ERROR", aErr.message, 500);
    if (!agent) return fail("NOT_FOUND", "Agent not found", 404);
    if ((agent as { user_id?: string | null }).user_id !== session.userId) {
      return fail("FORBIDDEN", "You can only edit your own profile", 403);
    }

    const agentUpdate: Record<string, unknown> = {};

    if ("bio" in patch) {
      const nextBio =
        patch.bio === null
          ? null
          : (() => {
              const t = String(patch.bio ?? "").trim();
              return t.length ? t.slice(0, TAGLINE_MAX) : null;
            })();
      agentUpdate.bio = nextBio;
    }

    if (Array.isArray(patch.brokers)) {
      const normalized = (() => {
        const seen = new Set<string>();
        const out: { broker_id: string; is_primary: boolean }[] = [];
        for (const b of patch.brokers) {
          const id = b.broker_id.trim();
          if (!id || seen.has(id)) continue;
          seen.add(id);
          out.push({ broker_id: id, is_primary: Boolean(b.is_primary) });
        }
        let primaryIdx = out.findIndex((x) => x.is_primary);
        if (primaryIdx < 0 && out.length > 0) primaryIdx = 0;
        return out.map((x, idx) => ({ ...x, is_primary: primaryIdx >= 0 ? idx === primaryIdx : false }));
      })();

      const primaryBrokerId =
        normalized.find((b) => b.is_primary)?.broker_id ?? normalized[0]?.broker_id ?? null;
      agentUpdate.broker_id = primaryBrokerId;

      // Replace junction rows.
      const { error: delErr } = await sb.from("agent_brokers").delete().eq("agent_id", agentId);
      if (delErr) return fail("DATABASE_ERROR", delErr.message, 500);
      if (normalized.length) {
        const payload = normalized.map((b) => ({
          agent_id: agentId,
          broker_id: b.broker_id,
          is_primary: b.is_primary,
        }));
        const { error: insErr } = await sb.from("agent_brokers").insert(payload);
        if (insErr) return fail("DATABASE_ERROR", insErr.message, 500);
      }
    }

    if (Object.keys(agentUpdate).length > 0) {
      const { error: upErr } = await sb.from("agents").update(agentUpdate).eq("id", agentId);
      if (upErr) return fail("DATABASE_ERROR", upErr.message, 500);
    }

    const { data: updated, error: rErr } = await sb
      .from("agents")
      .select("id, user_id, name, bio, image_url, specialties, languages_spoken, social_links, service_areas")
      .eq("id", agentId)
      .maybeSingle();
    if (rErr) return fail("DATABASE_ERROR", rErr.message, 500);

    return ok({ agent: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

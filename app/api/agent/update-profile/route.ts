import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TAGLINE_MAX = 25;

const bodySchema = z.object({
  agentId: z.string().min(1),
  patch: z
    .object({
      bio: z.union([z.string().max(TAGLINE_MAX), z.null()]),
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

    const nextBio =
      patch.bio === null
        ? null
        : (() => {
            const t = patch.bio.trim();
            return t.length ? t.slice(0, TAGLINE_MAX) : null;
          })();

    const { error: upErr } = await sb.from("agents").update({ bio: nextBio }).eq("id", agentId);
    if (upErr) return fail("DATABASE_ERROR", upErr.message, 500);

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

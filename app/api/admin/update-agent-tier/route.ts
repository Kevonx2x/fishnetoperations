import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  agent_id: z.string().uuid(),
  new_tier: z.enum(["free", "pro", "featured", "broker"]),
});

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function POST(req: Request) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const { agent_id, new_tier } = parsed.data;

  const sb = createSupabaseAdmin();
  const { data: agentRow, error: agentErr } = await sb
    .from("agents")
    .select("id, user_id, name, listing_tier")
    .eq("id", agent_id)
    .maybeSingle();

  if (agentErr) return fail("DATABASE_ERROR", agentErr.message, 500);
  if (!agentRow) return fail("NOT_FOUND", "Agent not found", 404);

  const oldTier = String((agentRow as { listing_tier?: string | null }).listing_tier ?? "free")
    .trim()
    .toLowerCase();

  const startedAt = new Date().toISOString();
  const expiresAt = addDaysIso(30);

  // Note: Supabase/PostgREST doesn't provide a multi-statement transaction here without a DB-side RPC.
  // We do best-effort with a compensating update on subscription insert failure.
  const { error: updErr } = await sb
    .from("agents")
    .update({ listing_tier: new_tier, updated_at: new Date().toISOString() })
    .eq("id", agent_id);
  if (updErr) return fail("DATABASE_ERROR", updErr.message, 500);

  const { data: subRow, error: subErr } = await sb
    .from("subscriptions")
    .insert({
      agent_id,
      tier: new_tier,
      status: "active",
      amount: 0,
      currency: "PHP",
      started_at: startedAt,
      expires_at: expiresAt,
    })
    .select("expires_at")
    .single();

  if (subErr) {
    await sb.from("agents").update({ listing_tier: oldTier }).eq("id", agent_id);
    return fail("DATABASE_ERROR", subErr.message, 500);
  }

  const agentUserId = String((agentRow as { user_id?: string | null }).user_id ?? "").trim();
  if (agentUserId) {
    // Notification failure shouldn't block the admin action.
    await sb.from("notifications").insert({
      user_id: agentUserId,
      type: "general",
      title: `Your listing tier was upgraded to ${new_tier}`,
      body: `An admin updated your listing tier to ${new_tier}. Active for 30 days.`,
      metadata: { agent_id, tier: new_tier },
    });
  }

  return ok({
    ok: true as const,
    new_tier,
    expires_at: (subRow as { expires_at?: string | null } | null)?.expires_at ?? expiresAt,
  });
}


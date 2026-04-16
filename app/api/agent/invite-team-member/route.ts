import { z } from "zod";
import { Resend } from "resend";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { RESEND_FROM } from "@/lib/resend-from";
import { normalizeListingTier } from "@/lib/agent-listing-limits";

const bodySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  role: z.string().min(1).max(80),
  phone: z.string().max(80).optional().nullable(),
  agent_id: z.string().uuid(),
});

const INVITE_ROLES = new Set([
  "Co-Agent",
  "Admin Assistant",
  "Virtual Assistant",
  "Marketing",
  "Other",
]);

type SubRow = { tier: string; status: string | null; expires_at: string | null };

function hasPaidPlanFromSubscriptions(rows: SubRow[]): boolean {
  const now = Date.now();
  for (const r of rows) {
    const st = (r.status ?? "active").toLowerCase();
    if (st !== "active") continue;
    if (r.expires_at && new Date(r.expires_at).getTime() < now) continue;
    const t = normalizeListingTier(r.tier);
    if (t === "pro" || t === "featured" || t === "broker") return true;
  }
  return false;
}

function publicInviteBaseUrl(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (site) return site;
  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;
  return "https://bahaygo.com";
}

export async function POST(req: Request) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) return fail("UNAUTHORIZED", "Sign in required", 401);
    if (session.role !== "agent" && session.role !== "admin") {
      return fail("FORBIDDEN", "Only listing agents can invite team members", 403);
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("BAD_REQUEST", "Invalid JSON", 400);
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fromZodError(parsed.error);

    const { name, email, role, phone, agent_id } = parsed.data;
    if (!INVITE_ROLES.has(role)) {
      return fail("VALIDATION_ERROR", "Invalid role", 422);
    }

    const admin = createSupabaseAdmin();

    const { data: agentRow, error: agentErr } = await admin
      .from("agents")
      .select("id, user_id, name")
      .eq("id", agent_id)
      .maybeSingle();

    if (agentErr) return fail("DATABASE_ERROR", agentErr.message, 500);
    const ar = agentRow as { id: string; user_id: string; name: string } | null;
    if (!ar) return fail("NOT_FOUND", "Agent not found", 404);
    if (session.role !== "admin" && ar.user_id !== session.userId) {
      return fail("FORBIDDEN", "Not your agent account", 403);
    }

    const { data: subs, error: subErr } = await admin
      .from("subscriptions")
      .select("tier,status,expires_at,created_at")
      .eq("agent_id", agent_id)
      .order("created_at", { ascending: false });
    if (subErr) return fail("DATABASE_ERROR", subErr.message, 500);
    if (!hasPaidPlanFromSubscriptions((subs ?? []) as SubRow[])) {
      return fail("FORBIDDEN", "Upgrade to Pro or Featured to invite team members", 403);
    }

    const emailNorm = email.trim().toLowerCase();
    const inviteToken = crypto.randomUUID();
    const inviteExpiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

    const { data: existing } = await admin
      .from("team_members")
      .select("id, status")
      .eq("agent_id", agent_id)
      .ilike("email", emailNorm)
      .maybeSingle();

    const existingRow = existing as { id: string; status: string | null } | null;

    if (existingRow?.status === "active") {
      return fail("CONFLICT", "This email is already an active team member", 409);
    }

    let row: Record<string, unknown> | null = null;

    if (existingRow && existingRow.status === "pending") {
      const { data: updated, error: upErr } = await admin
        .from("team_members")
        .update({
          name: name.trim(),
          role,
          phone: phone?.trim() || null,
          invite_token: inviteToken,
          invite_expires_at: inviteExpiresAt,
          status: "pending",
        })
        .eq("id", existingRow.id)
        .select("*")
        .maybeSingle();
      if (upErr) return fail("DATABASE_ERROR", upErr.message, 500);
      row = (updated as Record<string, unknown>) ?? null;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("team_members")
        .insert({
          agent_id,
          name: name.trim(),
          email: emailNorm,
          role,
          phone: phone?.trim() || null,
          status: "pending",
          invite_token: inviteToken,
          invite_expires_at: inviteExpiresAt,
          created_by: session.userId,
        })
        .select("*")
        .maybeSingle();
      if (insErr) return fail("DATABASE_ERROR", insErr.message, 500);
      row = (inserted as Record<string, unknown>) ?? null;
    }

    if (!row) return fail("DATABASE_ERROR", "Could not save invite", 500);

    const link = `${publicInviteBaseUrl()}/invite/${inviteToken}`;
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    if (!resend) {
      console.warn("[invite-team-member] RESEND_API_KEY missing; invite row saved but no email sent");
    } else {
      const { error: emailErr } = await resend.emails.send({
        from: RESEND_FROM,
        to: emailNorm,
        subject: "You have been invited to join BahayGo",
        html: `<p>${ar.name} has invited you to join their team on BahayGo as their <strong>${role}</strong>.</p>
<p>Click the link below to accept your invitation and set up your account.</p>
<p><a href="${link}">${link}</a></p>`,
      });
      if (emailErr) {
        console.error("[invite-team-member] Resend:", emailErr);
        return fail("EMAIL_ERROR", emailErr.message || "Failed to send invite email", 502);
      }
    }

    return ok(row);
  } catch (e) {
    console.error("[invite-team-member]", e);
    return fail("INTERNAL", e instanceof Error ? e.message : "Unexpected error", 500);
  }
}

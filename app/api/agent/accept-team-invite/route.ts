import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  token: z.string().uuid(),
  full_name: z.string().min(1).max(200),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  try {
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail("BAD_REQUEST", "Invalid JSON", 400);
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return fromZodError(parsed.error);

    const { token, full_name, password } = parsed.data;
    const admin = createSupabaseAdmin();

    const { data: invite, error: invErr } = await admin
      .from("team_members")
      .select("id, email, role, status, invite_expires_at, agent_id")
      .eq("invite_token", token)
      .maybeSingle();

    if (invErr) return fail("DATABASE_ERROR", invErr.message, 500);
    const inv = invite as {
      id: string;
      email: string;
      role: string;
      status: string | null;
      invite_expires_at: string | null;
      agent_id: string | null;
    } | null;

    if (!inv || !inv.agent_id) {
      return fail("NOT_FOUND", "Invalid or expired invitation", 404);
    }
    if (inv.status !== "pending") {
      return fail("BAD_REQUEST", "This invitation is no longer valid", 400);
    }
    if (inv.invite_expires_at && new Date(inv.invite_expires_at).getTime() < Date.now()) {
      return fail("GONE", "This invitation has expired. Please ask your agent to send a new one.", 410);
    }

    const email = inv.email.trim().toLowerCase();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
        role: "team_member",
      },
    });
    if (createErr || !created.user?.id) {
      const msg = createErr?.message ?? "Could not create account";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
        return fail("CONFLICT", "An account with this email already exists", 409);
      }
      return fail("AUTH_ERROR", msg, 400);
    }

    const uid = created.user.id;

    const { error: profErr } = await admin.from("profiles").upsert(
      {
        id: uid,
        full_name: full_name.trim(),
        email,
        role: "team_member",
      },
      { onConflict: "id" },
    );
    if (profErr) {
      console.error("[accept-team-invite] profile upsert:", profErr);
      await admin.auth.admin.deleteUser(uid);
      return fail("DATABASE_ERROR", profErr.message, 500);
    }

    const { error: tmErr } = await admin
      .from("team_members")
      .update({
        status: "active",
        accepted_at: new Date().toISOString(),
        user_id: uid,
        name: full_name.trim(),
      })
      .eq("id", inv.id);
    if (tmErr) {
      console.error("[accept-team-invite] team_members update:", tmErr);
      return fail("DATABASE_ERROR", tmErr.message, 500);
    }

    return ok({ userId: uid, email });
  } catch (e) {
    console.error("[accept-team-invite]", e);
    return fail("INTERNAL", e instanceof Error ? e.message : "Unexpected error", 500);
  }
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }
  try {
    const { id } = await ctx.params;
    const sb = createSupabaseAdmin();
    const { data: agent, error } = await sb
      .from("agents")
      .select("id, license_number, prc_document_url, selfie_url")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return fail("DATABASE_ERROR", error.message, 500);
    }
    if (!agent) {
      return fail("NOT_FOUND", "Agent not found", 404);
    }

    async function sign(path: string | null | undefined): Promise<string | null> {
      if (!path || typeof path !== "string") return null;
      const { data, error: signErr } = await sb.storage
        .from("verification")
        .createSignedUrl(path, 3600);
      if (signErr || !data?.signedUrl) {
        console.error("[verification-review] signed URL:", signErr);
        return null;
      }
      return data.signedUrl;
    }

    const [prc_signed_url, selfie_signed_url] = await Promise.all([
      sign(agent.prc_document_url),
      sign(agent.selfie_url),
    ]);

    return ok({
      license_number: agent.license_number,
      prc_signed_url,
      selfie_signed_url,
      has_documents: Boolean(agent.prc_document_url || agent.selfie_url),
    });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

const patchSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(2000).optional(),
});

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const sb = createSupabaseAdmin();
    const { data: existing, error: fetchErr } = await sb
      .from("agents")
      .select("id, user_id, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return fail("DATABASE_ERROR", fetchErr.message, 500);
    }
    if (!existing) {
      return fail("NOT_FOUND", "Agent not found", 404);
    }
    if (existing.status !== "approved") {
      return fail(
        "VALIDATION_ERROR",
        "Document review applies only to agents with approved status",
        422,
      );
    }

    const verification_status =
      parsed.data.decision === "approve" ? "verified" : "rejected";

    const { data: updated, error: upErr } = await sb
      .from("agents")
      .update({ verification_status })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (upErr) {
      return fail("DATABASE_ERROR", upErr.message, 500);
    }
    if (!updated) {
      return fail("NOT_FOUND", "Agent not found", 404);
    }

    const userId = updated.user_id as string;
    const isApprove = parsed.data.decision === "approve";
    const { error: notifErr } = await sb.from("notifications").insert({
      user_id: userId,
      type: "verification",
      title: isApprove
        ? "You're now a Verified Agent! 🎉"
        : "Verification unsuccessful",
      body: isApprove
        ? "Your PRC license has been verified. You now have full access to post listings and manage deals."
        : "Your documents could not be verified. Please resubmit in Settings → Verification.",
      metadata: {
        agent_id: updated.id,
        entity: "agent",
        identity_decision: parsed.data.decision,
        reason: parsed.data.reason?.trim() || null,
      },
    });
    if (notifErr) {
      console.error("[verification-review] notification insert:", notifErr);
    }

    return ok(updated);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

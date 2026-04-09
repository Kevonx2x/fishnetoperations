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

const patchSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve") }),
  z.object({
    decision: z.literal("reject"),
    reason: z.string().min(1).max(2000),
  }),
  z.object({
    decision: z.literal("suspend"),
    reason: z.string().min(1).max(2000),
  }),
]);

function notificationPayload(
  decision: "approve" | "reject" | "suspend",
  reason: string | undefined,
): { title: string; body: string } {
  if (decision === "approve") {
    return {
      title: "You're now a Verified Agent! 🎉",
      body: "Your PRC license has been verified. You now have full access to post listings and manage deals.",
    };
  }
  if (decision === "reject") {
    const r = reason?.trim() ?? "";
    return {
      title: "Verification unsuccessful",
      body: `Your documents could not be verified. Reason: ${r}. Please resubmit in Settings → Verification.`,
    };
  }
  const r = reason?.trim() ?? "";
  return {
    title: "Account suspended",
    body: `Your account has been suspended. Reason: ${r}. Contact support at support@bahaygo.com`,
  };
}

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
      .select("id, user_id, status, verification_status")
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

    const prevVerificationStatus = existing.verification_status;

    const d = parsed.data;
    const verification_status =
      d.decision === "approve"
        ? "verified"
        : d.decision === "reject"
          ? "rejected"
          : "suspended";

    const { data: updated, error: upErr } = await sb
      .from("agents")
      .update({ verification_status })
      .eq("id", id)
      .select("id, user_id")
      .maybeSingle();

    if (upErr) {
      return fail("DATABASE_ERROR", upErr.message, 500);
    }
    if (!updated?.user_id) {
      return fail("INTERNAL_ERROR", "Agent row missing user_id", 500);
    }

    const userId = updated.user_id as string;
    const reasonText =
      d.decision === "approve" ? undefined : d.reason.trim();
    const { title, body: notifBody } = notificationPayload(
      d.decision,
      reasonText,
    );

    const insertRow = {
      user_id: userId,
      type: "verification" as const,
      title,
      body: notifBody,
      metadata: {
        agent_id: updated.id,
        entity: "agent" as const,
        identity_decision: d.decision,
        reason: reasonText ?? null,
      },
    };

    const { error: notifErr } = await sb.from("notifications").insert(insertRow);

    if (notifErr) {
      console.error("[verification-review] notification insert failed:", {
        message: notifErr.message,
        code: notifErr.code,
        details: notifErr.details,
        hint: notifErr.hint,
      });
      const { error: revertErr } = await sb
        .from("agents")
        .update({ verification_status: prevVerificationStatus })
        .eq("id", id);
      if (revertErr) {
        console.error("[verification-review] revert failed:", revertErr);
      }
      return fail(
        "NOTIFICATION_ERROR",
        `Could not create notification: ${notifErr.message}`,
        500,
      );
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

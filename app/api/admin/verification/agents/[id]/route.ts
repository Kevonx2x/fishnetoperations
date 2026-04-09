import { NextRequest } from "next/server";
import { verificationDecisionSchema } from "@/lib/api/schemas/phase1-batch2";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return fail("UNAUTHORIZED", "Admin sign-in required", 401);
  }
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const parsed = verificationDecisionSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const sb = createSupabaseAdmin();
    const updates =
      parsed.data.decision === "approve"
        ? {
            status: "approved" as const,
            rejection_reason: null,
            verified: true,
            verification_status: "verified" as const,
          }
        : {
            status: "rejected" as const,
            rejection_reason: parsed.data.reason,
            verified: false,
            verification_status: "rejected" as const,
          };

    const { data, error } = await sb
      .from("agents")
      .update(updates)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return fail("DATABASE_ERROR", error.message, 500);
    }
    if (!data) {
      return fail("NOT_FOUND", "Agent not found", 404);
    }

    const userId = data.user_id as string | undefined;
    if (userId) {
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
          agent_id: data.id,
          entity: "agent",
          decision: parsed.data.decision,
        },
      });
      if (notifErr) {
        console.error("[admin verification agents] notification insert:", notifErr);
      }
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

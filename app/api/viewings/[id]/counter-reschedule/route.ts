import { NextRequest, NextResponse } from "next/server";
import { isValid, parseISO } from "date-fns";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { PROPERTY_ADDRESS_FALLBACK, propertyAddressLabel } from "@/lib/property-address-label";
import { authorizeViewingRescheduleMutation } from "@/lib/viewing-reschedule-server";
import { assertViewingSlotAvailable, fetchAgentViewingSlotSettings } from "@/lib/viewing-slot-conflict";

const bodySchema = z.object({
  scheduled_at: z.string().min(1),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: viewingUuid } = await ctx.params;
    if (!viewingUuid?.trim()) {
      return fail("BAD_REQUEST", "Missing viewing id", 400);
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fromZodError(parsed.error);

    const scheduledAt = parsed.data.scheduled_at.trim();
    const scheduled = parseISO(scheduledAt);
    if (!isValid(scheduled)) {
      return fail("BAD_REQUEST", "Invalid scheduled_at", 400);
    }
    const skewMs = 60_000;
    if (scheduled.getTime() <= Date.now() - skewMs) {
      return fail("BAD_REQUEST", "Proposed time must be in the future.", 400);
    }

    const auth = await authorizeViewingRescheduleMutation(viewingUuid.trim());
    if (!auth.ok) {
      const code =
        auth.status === 401 ? "UNAUTHORIZED" : auth.status === 403 ? "FORBIDDEN" : auth.status === 404 ? "NOT_FOUND" : "BAD_REQUEST";
      return fail(code, auth.message, auth.status);
    }

    const { admin, viewing, lead } = auth.bundle;
    const rescheduleId = viewing.reschedule_request_id!;
    const nowIso = new Date().toISOString();

    const ownerUserId =
      String(lead.agent_id ?? "").trim() || String(lead.broker_id ?? "").trim() || "";
    if (!ownerUserId) {
      return fail("BAD_REQUEST", "Lead has no assigned agent or broker.", 400);
    }
    const slotSettings = await fetchAgentViewingSlotSettings(admin, ownerUserId);
    const slotCheck = await assertViewingSlotAvailable(admin, {
      ownerUserId,
      scheduledAtIso: scheduledAt,
      settings: slotSettings,
      excludeViewingId: viewing.id,
    });
    if (!slotCheck.ok) {
      if (slotCheck.reason === "overlap") {
        return NextResponse.json(
          {
            error: "time_slot_unavailable",
            message: "This time conflicts with another viewing. Please choose a different time.",
            conflicting_viewing_id: slotCheck.viewingId,
            conflicting_scheduled_at: slotCheck.scheduledAt,
          },
          { status: 409 },
        );
      }
      return fail("BAD_REQUEST", slotCheck.message, slotCheck.status);
    }

    const { data: reqVr, error: reqErr } = await admin
      .from("viewing_requests")
      .select("scheduled_at")
      .eq("id", rescheduleId)
      .maybeSingle();
    if (reqErr || !reqVr) {
      return fail("DATABASE_ERROR", reqErr?.message ?? "Reschedule request not found", 500);
    }
    const originalRequestAt = String((reqVr as { scheduled_at: string }).scheduled_at);

    const { error: vu } = await admin
      .from("viewings")
      .update({
        scheduled_at: scheduledAt,
        reschedule_request_id: null,
        status: "scheduled",
        updated_at: nowIso,
      })
      .eq("id", viewing.id);
    if (vu) return fail("DATABASE_ERROR", vu.message, 500);

    const { error: vrDecl } = await admin.from("viewing_requests").update({ status: "declined" }).eq("id", rescheduleId);
    if (vrDecl) return fail("DATABASE_ERROR", vrDecl.message, 500);

    const { error: lu } = await admin
      .from("leads")
      .update({
        new_viewing_request_seen_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", lead.id);
    if (lu) return fail("DATABASE_ERROR", lu.message, 500);

    const propertyId = lead.property_id?.trim() ?? null;
    let propertyName = PROPERTY_ADDRESS_FALLBACK;
    if (propertyId) {
      const { data: propRow } = await admin.from("properties").select("name, location").eq("id", propertyId).maybeSingle();
      propertyName =
        (propRow as { name?: string | null } | null)?.name?.trim() ||
        (propRow as { location?: string | null } | null)?.location?.trim() ||
        propertyAddressLabel(propRow as { name?: string | null; location?: string | null } | null);
    }

    const clientUserId = lead.client_id?.trim();
    if (clientUserId) {
      const { error: nErr } = await admin.from("notifications").insert({
        user_id: clientUserId,
        type: "viewing_reschedule_countered",
        title: "Different viewing time proposed",
        body: `Your agent proposed another time for your viewing of ${propertyName}.`,
        metadata: {
          lead_id: lead.id,
          property_id: propertyId,
          property_name: propertyName,
          agent_proposed_at: scheduledAt,
          original_request_at: originalRequestAt,
        },
      });
      if (nErr) console.warn("[counter-reschedule] client notification insert failed", nErr);
    }

    return ok({ success: true, scheduled_at: scheduledAt });
  } catch (e) {
    console.error("[counter-reschedule]", e);
    return fail("SERVER_ERROR", "Unexpected error", 500);
  }
}

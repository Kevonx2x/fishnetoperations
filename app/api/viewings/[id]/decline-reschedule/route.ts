import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { PROPERTY_ADDRESS_FALLBACK, propertyAddressLabel } from "@/lib/property-address-label";
import { authorizeViewingRescheduleMutation } from "@/lib/viewing-reschedule-server";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: viewingUuid } = await ctx.params;
    if (!viewingUuid?.trim()) {
      return fail("BAD_REQUEST", "Missing viewing id", 400);
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

    const { error: vu } = await admin
      .from("viewings")
      .update({
        reschedule_request_id: null,
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
        type: "viewing_reschedule_declined",
        title: "Reschedule not accepted",
        body: `Your agent kept the original viewing time for ${propertyName}.`,
        metadata: {
          lead_id: lead.id,
          property_id: propertyId,
          property_name: propertyName,
          current_scheduled_at: viewing.scheduled_at,
        },
      });
      if (nErr) console.warn("[decline-reschedule] client notification insert failed", nErr);
    }

    return ok({ success: true });
  } catch (e) {
    console.error("[decline-reschedule]", e);
    return fail("SERVER_ERROR", "Unexpected error", 500);
  }
}

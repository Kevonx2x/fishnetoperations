import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  propertyId: z.string().uuid(),
  type: z.enum(["like", "pin"]),
  clientName: z.string().min(1).max(200),
});

/**
 * Notify the listing agent when someone likes or pins their property.
 * One notification per (agent, property, engagement type, client) — duplicates skipped.
 */
export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session) {
    return fail("UNAUTHORIZED", "Sign in required", 401);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const { propertyId, type, clientName } = parsed.data;

  try {
    const admin = createSupabaseAdmin();

    const { data: prop, error: propErr } = await admin
      .from("properties")
      .select("id, name, location, listed_by")
      .eq("id", propertyId)
      .maybeSingle();

    if (propErr) {
      return fail("DATABASE_ERROR", propErr.message, 500);
    }
    if (!prop?.listed_by) {
      return ok({ skipped: true, reason: "no_listing_agent" });
    }

    const agentUserId = prop.listed_by as string;
    if (agentUserId === session.userId) {
      return ok({ skipped: true, reason: "self" });
    }

    const propertyLabel =
      (typeof prop.name === "string" && prop.name.trim()) ||
      (typeof prop.location === "string" && prop.location.trim()) ||
      "your listing";

    const title =
      type === "like"
        ? "Someone liked your listing! ❤️"
        : "Someone pinned your listing! 📌";
    const body =
      type === "like"
        ? `${clientName} liked your ${propertyLabel}`
        : `${clientName} pinned your ${propertyLabel} to their wishlist`;

    const { data: existingRows } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", agentUserId)
      .eq("type", "general")
      .contains("metadata", {
        property_id: propertyId,
        engagement: type,
        from_client_user_id: session.userId,
      })
      .limit(1);

    if ((existingRows?.length ?? 0) > 0) {
      return ok({ skipped: true, reason: "already_notified" });
    }

    const { error: insErr } = await admin.from("notifications").insert({
      user_id: agentUserId,
      type: "general",
      title,
      body,
      metadata: {
        property_id: propertyId,
        engagement: type,
        from_client_user_id: session.userId,
      },
    });

    if (insErr) {
      return fail("DATABASE_ERROR", insErr.message, 500);
    }

    return ok({ notified: true });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

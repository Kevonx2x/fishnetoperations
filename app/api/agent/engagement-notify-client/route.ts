import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { propertyAddressLabel } from "@/lib/property-address-label";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  propertyId: z.string().uuid(),
  recipientUserId: z.string().uuid(),
  message: z.string().min(1).max(2000),
  agentFullName: z.string().min(1).max(200),
});

/**
 * Inserts a notification for a client when the listing agent sends a preset message from engagement UI.
 */
export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
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

  const { propertyId, recipientUserId, message, agentFullName } = parsed.data;

  try {
    const admin = createSupabaseAdmin();

    const { data: prof } = await admin
      .from("profiles")
      .select("role")
      .eq("id", session.userId)
      .maybeSingle();
    if ((prof as { role?: string } | null)?.role !== "agent") {
      return fail("FORBIDDEN", "Agents only", 403);
    }

    const { data: prop, error: propErr } = await admin
      .from("properties")
      .select("listed_by, name, location")
      .eq("id", propertyId)
      .maybeSingle();

    if (propErr) {
      return fail("DATABASE_ERROR", propErr.message, 500);
    }
    if (!prop) {
      return fail("NOT_FOUND", "Property not found", 404);
    }
    if ((prop as { listed_by?: string | null }).listed_by !== session.userId) {
      return fail("FORBIDDEN", "Not your listing", 403);
    }

    const propertyAddress = propertyAddressLabel(
      prop as { name?: string | null; location?: string | null },
    );
    const title = `Message from ${agentFullName.trim()} about ${propertyAddress}`;

    const { error: insErr } = await admin.from("notifications").insert({
      user_id: recipientUserId,
      type: "agent_message",
      title,
      body: message,
      property_name: propertyAddress,
      metadata: {
        property_id: propertyId,
        property_name: propertyAddress,
        from_agent_user_id: session.userId,
      },
    });

    if (insErr) {
      return fail("DATABASE_ERROR", insErr.message, 500);
    }

    return ok({ sent: true });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

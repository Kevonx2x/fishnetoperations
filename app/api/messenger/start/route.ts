import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { startConversation } from "@/lib/messenger/start-conversation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  otherUserId: z.string().uuid(),
  propertyId: z.string().uuid().optional().nullable(),
  dormspaceId: z.string().uuid().optional().nullable(),
});

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session) {
    return fail("UNAUTHORIZED", "Sign in required.", 401);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON.", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fromZodError(parsed.error);
  }

  const { otherUserId, propertyId, dormspaceId } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const result = await startConversation(supabase, {
    currentUserId: session.userId,
    otherUserId,
    propertyId: propertyId ?? null,
    dormspaceId: dormspaceId ?? null,
  });

  if (!result.ok) {
    return fail(result.code, result.message, result.status);
  }

  return ok({ conversationId: result.conversationId, created: result.created });
}

import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { recalculateAndPersistAgentScore } from "@/lib/recalculate-agent-score";

const bodySchema = z.object({
  userId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return fromZodError(parsed.error);

    const score = await recalculateAndPersistAgentScore(parsed.data.userId);
    if (score == null) {
      return fail("NOT_FOUND", "Could not update score", 404);
    }
    return ok({ score });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

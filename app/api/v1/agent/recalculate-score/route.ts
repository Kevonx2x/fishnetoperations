import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { recalculateAndPersistAgentScore } from "@/lib/recalculate-agent-score";

const bodySchema = z.object({
  userId: z.string().uuid(),
});

/** Avoid 404 on accidental GET/prefetch during dashboard load. */
export async function GET() {
  return ok({ score: null, updated: false });
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return fromZodError(parsed.error);

    const score = await recalculateAndPersistAgentScore(parsed.data.userId);
    if (score == null) {
      return ok({ score: null, updated: false });
    }
    return ok({ score, updated: true });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

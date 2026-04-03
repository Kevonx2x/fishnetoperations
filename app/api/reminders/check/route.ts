import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { processDueViewingReminders } from "@/lib/reminder-viewings";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return fail("UNAUTHORIZED", "Invalid cron authorization", 401);
  }
  try {
    const result = await processDueViewingReminders();
    return ok({ sent: result.sent, errors: result.errors });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

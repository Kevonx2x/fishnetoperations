import { NextRequest } from "next/server";
import { Resend } from "resend";
import { fail, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) {
      return fail("UNAUTHORIZED", "Sign in required", 401);
    }
    if (session.role !== "agent" && session.role !== "admin") {
      return fail("FORBIDDEN", "Agents only", 403);
    }

    const body = (await request.json()) as {
      to?: string;
      subject?: string;
      html?: string;
    };
    if (!body.to || !body.subject || !body.html) {
      return fail("BAD_REQUEST", "to, subject, and html required", 400);
    }
    if (!resend || !process.env.RESEND_API_KEY) {
      return fail("SERVICE_UNAVAILABLE", "Email not configured", 503);
    }

    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? "Fishnet Residences <onboarding@resend.dev>",
      to: body.to.trim(),
      subject: body.subject.trim(),
      html: body.html,
    });
    if (error) {
      return fail("EMAIL_ERROR", error.message, 502);
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

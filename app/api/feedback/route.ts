import { z } from "zod";
import { Resend } from "resend";
import { fail, fromZodError, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { RESEND_FROM } from "@/lib/resend-from";

const bodySchema = z.object({
  feedback: z.string().min(1).max(20000),
});

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session) {
    return fail("UNAUTHORIZED", "Sign in to send feedback", 401);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const email = session.email ?? "(no email)";
  const text = parsed.data.feedback.trim();

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  if (!resend) {
    console.warn("[feedback] RESEND_API_KEY not set");
    return fail("SERVICE_UNAVAILABLE", "Email is not configured", 503);
  }

  const { error } = await resend.emails.send({
    from: RESEND_FROM,
    to: "support@bahaygo.com",
    subject: "BahayGo Feedback",
    text: `From: ${email} (${session.userId})\n\n${text}`,
    html: `<p><strong>From:</strong> ${escapeHtml(email)} <small>(${escapeHtml(session.userId)})</small></p><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(text)}</pre>`,
  });

  if (error) {
    console.error("[feedback] Resend", error);
    return fail("EMAIL_ERROR", error.message, 500);
  }

  return ok({ success: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

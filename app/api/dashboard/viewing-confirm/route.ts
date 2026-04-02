import { NextRequest } from "next/server";
import { Resend } from "resend";
import { fail, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionProfile();
    if (!session?.userId) {
      return fail("UNAUTHORIZED", "Sign in to confirm viewings", 401);
    }

    const body = (await request.json()) as { viewingId?: string };
    const viewingId = body.viewingId;
    if (!viewingId || typeof viewingId !== "string") {
      return fail("BAD_REQUEST", "viewingId required", 400);
    }

    const sb = await createSupabaseServerClient();
    const { data: row, error: fetchErr } = await sb
      .from("viewing_requests")
      .select("id, agent_user_id, client_name, client_email, scheduled_at, status, property_id")
      .eq("id", viewingId)
      .maybeSingle();

    if (fetchErr) {
      return fail("DATABASE_ERROR", fetchErr.message, 500);
    }
    if (!row) {
      return fail("NOT_FOUND", "Viewing not found", 404);
    }

    const agentUserId = (row as { agent_user_id: string }).agent_user_id;
    if (agentUserId !== session.userId && session.role !== "admin") {
      return fail("FORBIDDEN", "Not your viewing", 403);
    }

    const { error: updErr } = await sb
      .from("viewing_requests")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", viewingId);

    if (updErr) {
      return fail("DATABASE_ERROR", updErr.message, 500);
    }

    const propertyId = (row as { property_id: string }).property_id;
    const { data: prop } = await sb
      .from("properties")
      .select("location, name")
      .eq("id", propertyId)
      .maybeSingle();

    const propLabel =
      (prop as { name?: string | null; location?: string } | null)?.name?.trim() ||
      (prop as { location?: string } | null)?.location ||
      "your selected property";
    const clientName = (row as { client_name: string }).client_name;
    const clientEmail = (row as { client_email: string }).client_email;
    const scheduledAt = (row as { scheduled_at: string }).scheduled_at;
    const when = new Date(scheduledAt).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

    if (process.env.RESEND_API_KEY) {
      const { error: emailErr } = await resend.emails.send({
        from:
          process.env.RESEND_FROM ??
          "Fishnet Residences <onboarding@resend.dev>",
        to: clientEmail,
        subject: `Viewing confirmed: ${propLabel}`,
        html: `
          <p>Hi ${escapeHtml(clientName)},</p>
          <p>Your property viewing has been <strong>confirmed</strong>.</p>
          <p><strong>Property:</strong> ${escapeHtml(propLabel)}</p>
          <p><strong>When:</strong> ${escapeHtml(when)}</p>
          <p>We look forward to seeing you.</p>
          <p>— Fishnet Residences</p>
        `,
      });
      if (emailErr) {
        console.error("Resend:", emailErr);
        return fail("EMAIL_ERROR", emailErr.message, 502);
      }
    }

    return ok({ success: true });
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

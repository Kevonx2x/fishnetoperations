import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const session = await getSessionProfile();
  if (!session?.userId) return fail("UNAUTHORIZED", "Sign in required", 401);
  if (session.role !== "client") return fail("FORBIDDEN", "Clients only", 403);

  const { leadId: leadIdRaw } = await ctx.params;
  const leadId = Number(leadIdRaw);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return fail("BAD_REQUEST", "Invalid leadId", 400);
  }

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return fail("SERVER_CONFIG", "Server is not configured.", 503);
  }

  const { data: row, error: leadErr } = await admin
    .from("leads")
    .select("id, client_id, archived_by_client")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) return fail("SERVER_ERROR", leadErr.message, 500);
  const lead = row as { id: number; client_id: string | null; archived_by_client: boolean | null } | null;
  if (!lead || lead.client_id !== session.userId) {
    return fail("NOT_FOUND", "Lead not found", 404);
  }
  if (!lead.archived_by_client) {
    return fail("BAD_REQUEST", "This lead is not archived.", 400);
  }

  const nowIso = new Date().toISOString();
  const { error: updErr } = await admin
    .from("leads")
    .update({
      archived_by_client: false,
      archived_at: null,
      archive_reason: null,
      archive_note: null,
      stage_at_archive: null,
      updated_at: nowIso,
    })
    .eq("id", leadId)
    .eq("client_id", session.userId);

  if (updErr) return fail("SERVER_ERROR", updErr.message, 500);

  return ok({ success: true });
}

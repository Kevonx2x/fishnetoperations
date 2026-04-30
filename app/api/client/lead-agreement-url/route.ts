import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const SIGNED_SEC = 3600;

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session?.userId) {
    return Response.json({ error: "Sign in required" }, { status: 401 });
  }
  if (session.role !== "client") {
    return Response.json({ error: "Clients only" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    offer_id?: unknown;
    reservation_id?: unknown;
  };
  const offerId = typeof body.offer_id === "string" ? body.offer_id.trim() : "";
  const reservationId = typeof body.reservation_id === "string" ? body.reservation_id.trim() : "";

  if ((offerId ? 1 : 0) + (reservationId ? 1 : 0) !== 1) {
    return Response.json({ error: "Provide exactly one of offer_id or reservation_id" }, { status: 400 });
  }

  let admin: ReturnType<typeof createSupabaseAdmin>;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return Response.json({ error: msg }, { status: 500 });
  }

  let leadId: number | null = null;
  let storagePath: string | null = null;

  if (offerId) {
    const { data: row, error } = await admin
      .from("offers")
      .select("id, lead_id, agreement_file_url")
      .eq("id", offerId)
      .maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!row) return Response.json({ error: "Offer not found" }, { status: 404 });
    leadId = (row as { lead_id: number }).lead_id;
    storagePath = ((row as { agreement_file_url?: string | null }).agreement_file_url ?? "").trim() || null;
  } else {
    const { data: row, error } = await admin
      .from("reservations")
      .select("id, lead_id, agreement_file_url")
      .eq("id", reservationId)
      .maybeSingle();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!row) return Response.json({ error: "Reservation not found" }, { status: 404 });
    leadId = (row as { lead_id: number }).lead_id;
    storagePath = ((row as { agreement_file_url?: string | null }).agreement_file_url ?? "").trim() || null;
  }

  if (!storagePath) {
    return Response.json({ error: "No document on file for this item" }, { status: 400 });
  }

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, client_id")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) return Response.json({ error: leadErr.message }, { status: 500 });
  if (!lead || (lead as { client_id: string | null }).client_id !== session.userId) {
    return Response.json({ error: "Not allowed" }, { status: 403 });
  }

  const { data: signed, error: signErr } = await admin.storage.from("deals").createSignedUrl(storagePath, SIGNED_SEC);

  if (signErr || !signed?.signedUrl) {
    return Response.json({ error: signErr?.message ?? "Could not create signed URL" }, { status: 500 });
  }

  return Response.json({ signedUrl: signed.signedUrl });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionProfile } from "@/lib/admin-api-auth";
import { fail, fromZodError } from "@/lib/api/response";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const bodySchema = z.object({
  dormspace_id: z.string().uuid(),
  name: z.string().min(1).max(500),
  email: z.string().email().max(320),
  phone: z.string().max(200).optional().nullable(),
  message: z.string().min(1).max(10000),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  const { dormspace_id, name, email, phone, message } = parsed.data;
  const session = await getSessionProfile();
  const admin = createSupabaseAdmin();

  const { data: listing, error: listErr } = await admin
    .from("dormspaces")
    .select("id, title, status")
    .eq("id", dormspace_id)
    .maybeSingle();

  if (listErr) return fail("SERVER_ERROR", "Could not load listing", 500);
  if (!listing || (listing.status !== "approved" && listing.status !== "pending")) {
    return fail("NOT_FOUND", "Dormspace not found", 404);
  }

  const { error: insertErr } = await admin.from("dormspace_inquiries").insert({
    dormspace_id,
    sender_user_id: session?.userId ?? null,
    name: name.trim(),
    email: email.trim(),
    phone: phone?.trim() || null,
    message: message.trim(),
    status: "new",
  });

  if (insertErr) {
    console.error("[dormspaces/inquiry] insert failed", insertErr);
    return fail("SERVER_ERROR", "Could not save inquiry", 500);
  }

  return NextResponse.json({ ok: true });
}

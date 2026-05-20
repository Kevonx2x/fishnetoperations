import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/admin-api-auth";
import { fail } from "@/lib/api/response";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  const session = await requireAdminSession();
  if (session === "unauthorized") return fail("UNAUTHORIZED", "Unauthorized", 401);

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("dormspaces")
    .select(
      "id, created_at, title, landlord_name, landlord_email, status, monthly_price, city, room_type",
    )
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/dormspaces] list failed", error);
    return fail("SERVER_ERROR", error.message, 500);
  }

  return NextResponse.json({ items: data ?? [] });
}

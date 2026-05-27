import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const SELECT =
  "id, name, short_name, full_name, city, image_url, display_order, is_active, created_at";

export async function GET() {
  const session = await requireAdminSession();
  if (session === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("universities")
    .select(SELECT)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ universities: data ?? [] });
}

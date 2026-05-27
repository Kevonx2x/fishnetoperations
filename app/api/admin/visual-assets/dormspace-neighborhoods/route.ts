import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/admin-api-auth";
import { slugifyVisualAssetName } from "@/lib/visual-assets";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const SELECT = "id, name, slug, city, image_url, display_order, is_active, created_at, updated_at";

export async function GET() {
  const session = await requireAdminSession();
  if (session === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("dormspace_featured_neighborhoods")
    .select(SELECT)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ neighborhoods: data ?? [] });
}

export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (session === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const name = body.name.trim();
  const slugRaw = typeof body.slug === "string" ? body.slug.trim() : "";
  const slug = slugRaw ? slugifyVisualAssetName(slugRaw) : slugifyVisualAssetName(name);
  const city = typeof body.city === "string" ? body.city.trim() || null : null;
  const image_url = typeof body.image_url === "string" ? body.image_url.trim() || null : null;
  const display_order = Math.max(0, Math.min(9999, Math.round(Number(body.display_order) || 100)));
  const is_active = body.is_active !== false;
  const now = new Date().toISOString();

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("dormspace_featured_neighborhoods")
    .insert({
      name,
      slug,
      city,
      image_url,
      display_order,
      is_active,
      updated_at: now,
    })
    .select(SELECT)
    .single();

  if (error) {
    const msg = error.code === "23505" ? "Slug already exists" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  revalidatePath("/dormspaces");
  return NextResponse.json({ neighborhood: data });
}

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/admin-api-auth";
import { slugifyVisualAssetName } from "@/lib/visual-assets";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const SELECT = "id, name, slug, city, image_url, display_order, is_active, created_at, updated_at";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (session === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.slug === "string" && body.slug.trim()) {
    patch.slug = slugifyVisualAssetName(body.slug);
  }
  if (typeof body.city === "string") patch.city = body.city.trim() || null;
  if (typeof body.image_url === "string") patch.image_url = body.image_url.trim() || null;
  if (body.display_order != null) {
    patch.display_order = Math.max(0, Math.min(9999, Math.round(Number(body.display_order) || 0)));
  }
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("dormspace_featured_neighborhoods")
    .update(patch)
    .eq("id", id)
    .select(SELECT)
    .maybeSingle();

  if (error) {
    const msg = error.code === "23505" ? "Slug already exists" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Neighborhood not found" }, { status: 404 });
  }

  revalidatePath("/dormspaces");
  return NextResponse.json({ neighborhood: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (session === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("dormspace_featured_neighborhoods").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/dormspaces");
  return NextResponse.json({ ok: true });
}

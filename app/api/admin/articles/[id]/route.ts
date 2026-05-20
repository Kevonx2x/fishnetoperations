import { NextResponse } from "next/server";
import { slugifyArticleTitle, isArticleCategory } from "@/lib/articles";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const SELECT =
  "id, slug, title, excerpt, body, category, cover_image_url, read_minutes, published, published_at, homepage_featured, homepage_order, created_at, updated_at";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.title === "string" && body.title.trim()) {
    patch.title = body.title.trim();
  }
  if (typeof body.slug === "string" && body.slug.trim()) {
    patch.slug = slugifyArticleTitle(body.slug);
  }
  if (typeof body.excerpt === "string") {
    patch.excerpt = body.excerpt.trim();
  }
  if (typeof body.body === "string") {
    patch.body = body.body.trim();
  }
  if (typeof body.category === "string" && body.category.trim()) {
    const cat = body.category.trim().toUpperCase();
    patch.category = isArticleCategory(cat) ? cat : cat.slice(0, 64);
  }
  if (typeof body.cover_image_url === "string") {
    patch.cover_image_url = body.cover_image_url.trim();
  }
  if (body.read_minutes != null) {
    patch.read_minutes = Math.min(60, Math.max(1, Math.round(Number(body.read_minutes) || 5)));
  }
  if (typeof body.homepage_featured === "boolean") {
    patch.homepage_featured = body.homepage_featured;
  }
  if (body.homepage_order != null) {
    patch.homepage_order = Math.max(0, Math.min(99, Math.round(Number(body.homepage_order) || 0)));
  }
  if (typeof body.published === "boolean") {
    patch.published = body.published;
    if (body.published) {
      patch.published_at = new Date().toISOString();
    }
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("articles")
    .update(patch)
    .eq("id", id)
    .select(SELECT)
    .maybeSingle();

  if (error) {
    const msg = error.code === "23505" ? "Slug already exists." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ article: data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

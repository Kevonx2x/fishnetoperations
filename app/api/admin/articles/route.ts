import { NextResponse } from "next/server";
import { slugifyArticleTitle, isArticleCategory, ARTICLE_CATEGORIES } from "@/lib/articles";
import { requireAdminSession } from "@/lib/admin-api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const SELECT =
  "id, slug, title, excerpt, body, category, cover_image_url, read_minutes, published, published_at, homepage_featured, homepage_order, created_at, updated_at";

export async function GET() {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("articles")
    .select(SELECT)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ articles: data ?? [] });
}

export async function POST(req: Request) {
  const denied = await requireAdminSession();
  if (denied === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const title = body.title.trim();
  const slugRaw = typeof body.slug === "string" ? body.slug.trim() : "";
  const slug = slugRaw ? slugifyArticleTitle(slugRaw) : slugifyArticleTitle(title);
  const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() : "";
  const articleBody = typeof body.body === "string" ? body.body.trim() : "";
  const category =
    typeof body.category === "string" && isArticleCategory(body.category.toUpperCase())
      ? body.category.toUpperCase()
      : ARTICLE_CATEGORIES[0];
  const cover_image_url =
    typeof body.cover_image_url === "string" ? body.cover_image_url.trim() : "";
  const read_minutes = Math.min(
    60,
    Math.max(1, Math.round(Number(body.read_minutes) || 5)),
  );
  const published = body.published === true;
  const homepage_featured = body.homepage_featured === true;
  const homepage_order = Math.max(0, Math.min(99, Math.round(Number(body.homepage_order) || 0)));

  const now = new Date().toISOString();
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("articles")
    .insert({
      slug,
      title,
      excerpt,
      body: articleBody,
      category,
      cover_image_url,
      read_minutes,
      published,
      published_at: published ? now : null,
      homepage_featured,
      homepage_order,
      updated_at: now,
    })
    .select(SELECT)
    .single();

  if (error) {
    const msg = error.code === "23505" ? "Slug already exists — choose another title or slug." : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ article: data });
}

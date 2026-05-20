import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const trimmed = slug?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("articles")
    .select(
      "id, slug, title, excerpt, body, category, cover_image_url, read_minutes, published, published_at, homepage_featured, homepage_order, created_at, updated_at",
    )
    .eq("slug", trimmed)
    .eq("published", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ article: data });
}

import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/** Public list of published articles. ?featured=homepage&limit=3 for homepage cards. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const featured = searchParams.get("featured");
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 50;

  const supabase = createSupabaseAdmin();
  let query = supabase
    .from("articles")
    .select(
      "id, slug, title, excerpt, body, category, cover_image_url, read_minutes, published, published_at, homepage_featured, homepage_order, created_at, updated_at",
    )
    .eq("published", true);

  if (featured === "homepage") {
    query = query.eq("homepage_featured", true).order("homepage_order", { ascending: true });
  } else {
    query = query.order("published_at", { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query.limit(limit);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ articles: data ?? [] });
}

import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { createSupabaseUserClient } from "@/lib/supabase-route";

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseUserClient(request);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return fail("UNAUTHORIZED", "Bearer token required", 401);
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "1";

    let q = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (unreadOnly) {
      q = q.is("read_at", null);
    }

    const { data, error } = await q;
    if (error) return fail("DATABASE_ERROR", error.message, 500);
    return ok(data ?? []);
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
}

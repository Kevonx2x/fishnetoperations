import { createClient } from "@supabase/supabase-js";
import { fail, ok } from "@/lib/api/response";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";

/** Public approved brokers (for agent registration broker picker). RLS restricts rows. */
export async function GET() {
  let url: string;
  let anon: string;
  try {
    const env = getPublicSupabaseEnv();
    url = env.url;
    anon = env.anonKey;
  } catch {
    return fail("CONFIG_ERROR", "Missing Supabase env", 500);
  }
  try {
    const sb = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .from("brokers")
      .select("id, company_name")
      .eq("status", "approved")
      .eq("verified", true)
      .order("company_name", { ascending: true });
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

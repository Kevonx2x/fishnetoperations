import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";

/**
 * Supabase client that forwards the caller's Bearer JWT (for RLS).
 */
export function createSupabaseUserClient(request: NextRequest): SupabaseClient {
  const { url, anonKey: anon } = getPublicSupabaseEnv();
  const auth = request.headers.get("authorization");
  return createClient(url, anon, {
    global: {
      headers: auth ? { Authorization: auth } : {},
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

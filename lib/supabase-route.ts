import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

/**
 * Supabase client that forwards the caller's Bearer JWT (for RLS).
 */
export function createSupabaseUserClient(request: NextRequest): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const auth = request.headers.get("authorization");
  return createClient(url, anon, {
    global: {
      headers: auth ? { Authorization: auth } : {},
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

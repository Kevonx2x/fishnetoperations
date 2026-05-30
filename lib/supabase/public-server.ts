import { createClient } from "@supabase/supabase-js";

import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";

/** Cookie-less Supabase client for public SSR data (homepage listings, maps). Enables ISR. */
export function createSupabasePublicServerClient() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createClient(url, anonKey);
}

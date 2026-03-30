import { createClient } from "@supabase/supabase-js";

/** Browser Supabase client (session in localStorage). */
export function createSupabaseBrowser() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

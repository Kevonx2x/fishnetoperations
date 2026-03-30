import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client — keeps auth in sync with server via cookies. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

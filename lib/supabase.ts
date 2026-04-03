import { createSupabaseBrowserClient } from "./supabase/client";

/**
 * Shared browser client for public pages (e.g. homepage listings).
 * Uses `NEXT_PUBLIC_SUPABASE_*` via `createSupabaseBrowserClient()` — see `lib/supabase/public-env.ts`.
 */
export const supabase = createSupabaseBrowserClient();

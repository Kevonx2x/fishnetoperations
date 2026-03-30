import { createSupabaseBrowserClient } from "./supabase/client";

/** Shared browser client for public pages (e.g. homepage listings). */
export const supabase = createSupabaseBrowserClient();

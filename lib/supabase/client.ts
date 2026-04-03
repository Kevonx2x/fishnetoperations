import { createBrowserClient } from "@supabase/ssr";
import {
  getPublicSupabaseEnv,
  logSupabasePublicEnvDebugOnce,
} from "@/lib/supabase/public-env";

/** Browser Supabase client — keeps auth in sync with server via cookies. */
export function createSupabaseBrowserClient() {
  logSupabasePublicEnvDebugOnce();
  const { url, anonKey } = getPublicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}

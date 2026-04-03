/**
 * NEXT_PUBLIC_* Supabase values are inlined at **build time** in Next.js.
 * If they are missing when `next build` runs (e.g. not set for Production in Vercel),
 * the client bundle will contain `undefined` and requests return 401 "No API key found".
 */

export type PublicSupabaseEnv = {
  url: string;
  anonKey: string;
};

function trimOrEmpty(v: string | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Mask anon key for logs (never log full secret). */
export function maskSupabaseAnonKey(key: string | undefined): string {
  if (!key) return "(missing)";
  const t = key.trim();
  if (t.length <= 12) return `*** (len=${t.length})`;
  return `${t.slice(0, 6)}…${t.slice(-4)} (len=${t.length})`;
}

export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  const url = trimOrEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = trimOrEmpty(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Add both to your host (e.g. Vercel → Project → Settings → Environment Variables) " +
        "for Production, then redeploy. NEXT_PUBLIC_* values are embedded at build time.",
    );
  }
  return { url, anonKey };
}

let _debugLoggedBrowser = false;

/**
 * TEMP: Remove after confirming production env — logs only in the browser, masked key.
 */
export function logSupabasePublicEnvDebugOnce(): void {
  if (typeof window === "undefined" || _debugLoggedBrowser) return;
  _debugLoggedBrowser = true;
  const url = trimOrEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = trimOrEmpty(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  console.log("[Supabase browser] NEXT_PUBLIC_SUPABASE_URL:", url || "(missing)");
  console.log("[Supabase browser] NEXT_PUBLIC_SUPABASE_ANON_KEY:", maskSupabaseAnonKey(anon));
}

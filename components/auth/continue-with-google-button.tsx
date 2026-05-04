"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Official multicolor Google "G" mark (inline SVG, no external fetch). */
function GoogleGMark({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      viewBox="0 0 48 48"
      width={18}
      height={18}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.98 34.03 48 29.59 48 24c0-1.65-.13-3.25-.37-4.77l-8.14 6.31z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l8.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.28-13.47-10.07l-8.02 6.18C7.08 42.43 14.31 48 24 48z"
      />
    </svg>
  );
}

export function AuthGoogleDivider() {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <div className="w-full border-t border-[#2C2C2C]/10" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-white px-2 font-medium text-[#2C2C2C]/45">or</span>
      </div>
    </div>
  );
}

export function ContinueWithGoogleButton({ onError }: { onError?: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) {
        onError?.("Supabase is not configured. Check environment variables.");
        setBusy(false);
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });
      if (error) {
        onError?.(error.message);
        setBusy(false);
        return;
      }
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      onError?.("Could not start Google sign-in.");
      setBusy(false);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Could not start Google sign-in.");
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy}
      className={cn(
        "flex w-full min-h-[44px] items-center justify-center gap-3 rounded-xl border border-[#2C2C2C]/12 bg-white px-4 py-3 text-[14px] font-medium text-[#2C2C2C] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      {busy ? <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-[#2C2C2C]/70" aria-hidden /> : <GoogleGMark />}
      <span>{busy ? "Redirecting…" : "Continue with Google"}</span>
    </button>
  );
}

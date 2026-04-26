"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const cache = new Map<string, string | undefined>();

/**
 * When Stream Chat user `image` is empty, resolve avatar from `profiles.avatar_url`.
 * Cached per user id to avoid duplicate requests (e.g. many messages from same sender).
 */
export function useProfileAvatarUrl(userId: string | undefined, streamImage: string | null | undefined) {
  const trimmed = streamImage?.trim();
  const [resolved, setResolved] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!userId) {
      setResolved(undefined);
      return;
    }
    if (trimmed) {
      setResolved(undefined);
      return;
    }
    if (cache.has(userId)) {
      setResolved(cache.get(userId));
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        cache.set(userId, undefined);
        setResolved(undefined);
        return;
      }
      const url = (data?.avatar_url as string | undefined)?.trim() || undefined;
      cache.set(userId, url);
      setResolved(url);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, trimmed]);

  return trimmed || resolved;
}

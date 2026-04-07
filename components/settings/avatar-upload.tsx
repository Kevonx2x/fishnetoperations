"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import type { SupabaseClient } from "@supabase/supabase-js";
import { agentAvatarInitials } from "@/components/marketplace/agent-avatar";
import { getPublicSupabaseEnv } from "@/lib/supabase/public-env";
import {
  avatarObjectExt,
  uploadToAvatarsBucket,
  validateAvatarFile,
} from "@/lib/supabase/upload-avatar";

type Props = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  supabase: SupabaseClient;
  onUploaded: (publicUrl: string) => void;
};

export function SettingsAvatarUpload({
  userId,
  fullName,
  avatarUrl,
  supabase,
  onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pick = useCallback(() => {
    setError(null);
    inputRef.current?.click();
  }, []);

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      const v = validateAvatarFile(file);
      if (v) {
        setError(v);
        return;
      }

      setError(null);
      setUploading(true);
      setProgress(0);

      try {
        const ext = avatarObjectExt(file);
        const path = `${userId}/avatar.${ext}`;
        const { url, anonKey } = getPublicSupabaseEnv();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          throw new Error("You must be signed in to upload an avatar.");
        }

        await uploadToAvatarsBucket(url, anonKey, token, path, file, setProgress);

        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        const busted = `${pub.publicUrl}?t=${Date.now()}`;

        const { error: upErr } = await supabase
          .from("profiles")
          .update({ avatar_url: busted })
          .eq("id", userId);
        if (upErr) throw upErr;

        onUploaded(busted);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [onUploaded, supabase, userId],
  );

  const showImg = Boolean(avatarUrl?.trim());
  const initials = agentAvatarInitials(fullName || "?");

  return (
    <div className="flex flex-col items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Choose profile photo"
        onChange={(e) => void onFile(e)}
      />
      <button
        type="button"
        onClick={pick}
        disabled={uploading}
        className="group relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 border-[#2C2C2C]/10 bg-[#FAF8F4] shadow-sm outline-none ring-offset-2 transition hover:border-[#6B9E6E]/50 focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/35 disabled:opacity-70"
      >
        {showImg ? (
          <Image
            src={avatarUrl!}
            alt=""
            width={112}
            height={112}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-[#6B9E6E] text-2xl font-bold text-white">
            {initials}
          </span>
        )}
        {uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
            <span className="text-xs font-bold tabular-nums">{progress}%</span>
          </div>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[10px] font-semibold text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
            Change photo
          </span>
        )}
      </button>
      <p className="text-center text-xs text-[#2C2C2C]/50">
        JPG, PNG, or WEBP · max 2MB · click to upload
      </p>
      {uploading ? (
        <div className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-[#2C2C2C]/10">
          <div
            className="h-full rounded-full bg-[#6B9E6E] transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      {error ? <p className="max-w-xs text-center text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

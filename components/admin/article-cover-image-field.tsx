"use client";

import { useCallback, useId, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 12 * 1024 * 1024;

type ArticleCoverImageFieldProps = {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  inputClassName?: string;
};

export function ArticleCoverImageField({
  value,
  onChange,
  disabled,
  inputClassName,
}: ArticleCoverImageFieldProps) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = localPreview || value.trim() || null;

  const uploadFile = useCallback(
    async (file: File) => {
      if (!ACCEPT_MIME.has(file.type)) {
        setError("Use JPG, PNG, or WEBP only.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("Image must be 12MB or smaller.");
        return;
      }
      setError(null);
      const objectUrl = URL.createObjectURL(file);
      setLocalPreview(objectUrl);
      setUploading(true);
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("purpose", "article");
        const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
        const json = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !json.url) {
          setError(json.error ?? "Upload failed");
          setLocalPreview(null);
          return;
        }
        onChange(json.url);
        setLocalPreview(null);
      } catch {
        setError("Could not reach server");
        setLocalPreview(null);
      } finally {
        URL.revokeObjectURL(objectUrl);
        setUploading(false);
      }
    },
    [onChange],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void uploadFile(file);
  };

  const clearImage = () => {
    onChange("");
    setLocalPreview(null);
    setError(null);
  };

  return (
    <div className="space-y-3 sm:col-span-2">
      <span className="text-xs font-bold text-[#2C2C2C]/55">Cover image</span>

      {previewUrl ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-[#2C2C2C]/15 bg-[#F3F0EA]">
          <Image
            src={previewUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 640px"
            unoptimized
          />
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-8 w-8 animate-spin text-white" aria-hidden />
            </div>
          ) : null}
          {!disabled && !uploading ? (
            <button
              type="button"
              onClick={clearImage}
              className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-[#2C2C2C] shadow hover:bg-white"
              aria-label="Remove cover image"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#2C2C2C]/20 bg-[#FAF8F4] px-4 py-8 text-sm font-semibold text-[#2C2C2C]/65 transition hover:border-[#6B9E6E]/50 hover:bg-[#6B9E6E]/5 disabled:opacity-50",
          )}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-[#6B9E6E]" aria-hidden />
          ) : (
            <ImagePlus className="h-8 w-8 text-[#6B9E6E]" aria-hidden />
          )}
          {uploading ? "Uploading…" : "Upload from your computer"}
          <span className="text-xs font-medium text-[#2C2C2C]/45">JPG, PNG, or WEBP · max 12MB</span>
        </button>
      )}

      <input
        id={inputId}
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={onFileChange}
      />

      {!previewUrl && !uploading ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="text-xs font-semibold text-[#6B9E6E] hover:underline disabled:opacity-50"
        >
          Choose file…
        </button>
      ) : !uploading ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="text-xs font-semibold text-[#6B9E6E] hover:underline disabled:opacity-50"
        >
          Replace image
        </button>
      ) : null}

      <label className="block">
        <span className="text-xs font-medium text-[#2C2C2C]/45">Or paste image URL</span>
        <input
          value={value}
          onChange={(e) => {
            setError(null);
            setLocalPreview(null);
            onChange(e.target.value);
          }}
          placeholder="https://…"
          disabled={disabled || uploading}
          className={cn(inputClassName, "mt-1")}
        />
      </label>

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

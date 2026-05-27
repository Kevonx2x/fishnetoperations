"use client";

import { useCallback, useId, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 12 * 1024 * 1024;

type Props = {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  variant: "university" | "landscape";
  inputClassName?: string;
};

export function VisualAssetImageField({
  value,
  onChange,
  disabled,
  variant,
  inputClassName,
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = localPreview || value.trim() || null;
  const helperText =
    variant === "university"
      ? "Square image recommended (400×400). PNG or JPG."
      : "Landscape image recommended (800×600). PNG or JPG.";

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
        fd.set("purpose", "visual-asset");
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

  const previewClass =
    variant === "university"
      ? "relative mx-auto size-24 overflow-hidden rounded-full border border-[#2C2C2C]/15 bg-[#F3F0EA]"
      : "relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#2C2C2C]/15 bg-[#F3F0EA]";

  return (
    <div className="space-y-2">
      {previewUrl ? (
        <div className={previewClass}>
          <Image src={previewUrl} alt="" fill className="object-cover" sizes="240px" unoptimized />
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
            </div>
          ) : null}
          {!disabled && !uploading ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-1 top-1 rounded-full bg-white/95 p-1 text-[#2C2C2C] shadow hover:bg-white"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#2C2C2C]/20 bg-[#FAF8F4] px-4 py-6 text-sm font-semibold text-[#2C2C2C]/65 transition hover:border-[#6B9E6E]/50 hover:bg-[#6B9E6E]/5 disabled:opacity-50",
          )}
        >
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-[#6B9E6E]" aria-hidden />
          ) : (
            <ImagePlus className="h-7 w-7 text-[#6B9E6E]" aria-hidden />
          )}
          {uploading ? "Uploading…" : "Upload image"}
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

      <p className="text-xs font-medium text-[#2C2C2C]/50">{helperText}</p>

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
          className={cn(
            "mt-1 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2 text-sm text-[#2C2C2C]",
            inputClassName,
          )}
        />
      </label>

      {!previewUrl && !uploading ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="text-xs font-semibold text-[#6B9E6E] hover:underline disabled:opacity-50"
        >
          Choose file…
        </button>
      ) : null}

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

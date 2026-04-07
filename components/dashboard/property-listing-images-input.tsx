"use client";

import Image from "next/image";
import { useCallback, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

const MAX_IMAGES = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function extForMime(mime: string): string | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

export type PropertyListingImagesInputProps = {
  supabase: SupabaseClient;
  userId: string;
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
  maxImages?: number;
};

export function PropertyListingImagesInput({
  supabase,
  userId,
  value,
  onChange,
  disabled,
  maxImages = MAX_IMAGES,
}: PropertyListingImagesInputProps) {
  const inputId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeFile, setActiveFile] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const canAdd = value.length < maxImages && !disabled;

  const uploadOne = useCallback(
    async (file: File): Promise<string> => {
      if (!ACCEPT_MIME.has(file.type)) {
        throw new Error("Use JPG, PNG, or WEBP only.");
      }
      if (file.size > MAX_BYTES) {
        throw new Error("Each image must be 5MB or smaller.");
      }
      const ext = extForMime(file.type);
      if (!ext) throw new Error("Invalid image type.");
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("property-images").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("property-images").getPublicUrl(path);
      return data.publicUrl;
    },
    [supabase, userId],
  );

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter(Boolean);
      if (list.length === 0) return;
      setLocalError(null);
      const remaining = maxImages - value.length;
      if (remaining <= 0) {
        setLocalError(`You can add up to ${maxImages} images.`);
        return;
      }
      const toUpload = list.slice(0, remaining);
      setUploading(true);
      setTotalFiles(toUpload.length);
      setActiveFile(0);
      setProgress(0);
      const next: string[] = [...value];
      try {
        for (let i = 0; i < toUpload.length; i++) {
          setActiveFile(i + 1);
          setProgress(Math.round((i / toUpload.length) * 100));
          const url = await uploadOne(toUpload[i]);
          next.push(url);
          onChange([...next]);
        }
        setProgress(100);
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setUploading(false);
        setTotalFiles(0);
        setActiveFile(0);
        setProgress(0);
      }
    },
    [maxImages, onChange, uploadOne, value],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (!canAdd || uploading) return;
      void processFiles(e.dataTransfer.files);
    },
    [canAdd, processFiles, uploading],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files;
      e.target.value = "";
      if (!f?.length) return;
      void processFiles(f);
    },
    [processFiles],
  );

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
        Photos <span className="font-normal normal-case text-[#2C2C2C]/40">(first = main listing image)</span>
      </p>
      <p className="text-[11px] font-semibold text-[#2C2C2C]/50">JPG, PNG, or WEBP · max 5MB each · up to {maxImages} images</p>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((url, i) => (
            <li
              key={`${url}-${i}`}
              className="relative h-20 w-20 overflow-hidden rounded-lg border border-[#2C2C2C]/10 bg-[#EBE6DC]"
            >
              <Image src={url} alt="" fill className="object-cover" sizes="80px" unoptimized />
              {i === 0 ? (
                <span className="absolute left-1 top-1 rounded bg-[#2C2C2C]/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Main
                </span>
              ) : null}
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => removeAt(i)}
                className="absolute bottom-1 right-1 rounded-full bg-white/95 p-1 text-red-700 shadow hover:bg-red-50 disabled:opacity-50"
                aria-label="Remove image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {canAdd ? (
        <label
          htmlFor={inputId}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
            dragOver ? "border-[#6B9E6E] bg-[#6B9E6E]/10" : "border-[#2C2C2C]/20 bg-white hover:border-[#D4A843]/50",
            (disabled || uploading) && "pointer-events-none opacity-60",
          )}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={disabled || uploading}
            onChange={onPick}
          />
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-[#6B9E6E]" />
              <span className="text-xs font-semibold text-[#2C2C2C]/70">
                Uploading {activeFile}/{totalFiles}…
              </span>
              <div className="h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-[#EBE6DC]">
                <div
                  className="h-full rounded-full bg-[#6B9E6E] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[#2C2C2C]/70">
                <Upload className="h-5 w-5" />
                <ImagePlus className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold text-[#2C2C2C]">Drop images here or click to browse</span>
              <span className="text-xs font-semibold text-[#2C2C2C]/45">
                {value.length}/{maxImages} used
              </span>
            </>
          )}
        </label>
      ) : (
        <p className="text-xs font-semibold text-[#2C2C2C]/45">Maximum {maxImages} images reached. Remove one to add more.</p>
      )}

      {localError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{localError}</p>
      ) : null}
    </div>
  );
}

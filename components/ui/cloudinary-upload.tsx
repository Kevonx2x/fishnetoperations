"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

function reorderUrls(urls: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= urls.length || to >= urls.length) return urls;
  const next = [...urls];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const ACCEPT_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 12 * 1024 * 1024;

export type CloudinaryUploadProps = {
  /** Current Cloudinary (or remote) image URLs, first = main listing image */
  value?: string[];
  onUpload: (urls: string[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  /** Native tooltip when `disabled` (e.g. co-listing read-only gallery). */
  disabledTooltip?: string;
  /** When set, `/api/upload` verifies the user is the listing owner (`properties.listed_by`) before accepting. */
  listingPropertyId?: string;
};

export function CloudinaryUpload({
  value = [],
  onUpload,
  maxFiles = 10,
  disabled,
  disabledTooltip,
  listingPropertyId,
}: CloudinaryUploadProps) {
  const inputId = useId();
  const valueRef = useRef(value);
  valueRef.current = value;
  const flightRef = useRef(0);

  const [dragOver, setDragOver] = useState(false);
  const [dragPhotoIndex, setDragPhotoIndex] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<
    Array<{
      id: string;
      preview: string;
      progress: number;
      name: string;
    }>
  >([]);

  const canAdd = value.length + uploading.length < maxFiles && !disabled;

  const uploadOne = useCallback((file: File) => {
      if (!ACCEPT_MIME.has(file.type)) {
        setLocalError("Use JPG, PNG, or WEBP only.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setLocalError("Each image must be 12MB or smaller.");
        return;
      }
      setLocalError(null);
      flightRef.current += 1;
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      setUploading((u) => [...u, { id, preview, progress: 0, name: file.name }]);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setUploading((u) => u.map((x) => (x.id === id ? { ...x, progress: pct } : x)));
        }
      };
      xhr.onload = () => {
        flightRef.current = Math.max(0, flightRef.current - 1);
        URL.revokeObjectURL(preview);
        setUploading((u) => u.filter((x) => x.id !== id));
        try {
          const json = JSON.parse(xhr.responseText) as { url?: string; error?: string };
          if (xhr.status >= 200 && xhr.status < 300 && json.url) {
            onUpload([...valueRef.current, json.url]);
          } else {
            setLocalError(json.error ?? "Upload failed.");
          }
        } catch {
          setLocalError("Upload failed.");
        }
      };
      xhr.onerror = () => {
        flightRef.current = Math.max(0, flightRef.current - 1);
        URL.revokeObjectURL(preview);
        setUploading((u) => u.filter((x) => x.id !== id));
        setLocalError("Network error.");
      };
      const fd = new FormData();
      fd.set("file", file);
      if (listingPropertyId?.trim()) {
        fd.set("property_id", listingPropertyId.trim());
      }
      xhr.send(fd);
    }, [onUpload, listingPropertyId]);

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter(Boolean);
      if (list.length === 0) return;
      const remaining = maxFiles - valueRef.current.length - flightRef.current;
      if (remaining <= 0) {
        setLocalError(`You can add up to ${maxFiles} images.`);
        return;
      }
      const toUpload = list.slice(0, remaining);
      for (const f of toUpload) {
        uploadOne(f);
      }
    },
    [maxFiles, uploadOne],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (!canAdd) return;
      void processFiles(e.dataTransfer.files);
    },
    [canAdd, processFiles],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length === 0) return;
      void processFiles(files);
    },
    [processFiles],
  );

  const removeAt = (index: number) => {
    onUpload(value.filter((_, i) => i !== index));
  };

  const onThumbDragStart = (index: number) => (e: React.DragEvent) => {
    setDragPhotoIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const onThumbDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onThumbDrop = (toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragPhotoIndex;
    setDragPhotoIndex(null);
    if (from === null) return;
    onUpload(reorderUrls(value, from, toIndex));
  };

  const onThumbDragEnd = () => setDragPhotoIndex(null);

  return (
    <div
      className="space-y-2"
      title={disabled && disabledTooltip ? disabledTooltip : undefined}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
        Photos <span className="font-normal normal-case text-[#2C2C2C]/40">(first = main listing image)</span>
      </p>
      <p className="text-[11px] font-semibold text-[#2C2C2C]/50">JPG, PNG, or WEBP · max 12MB each · up to {maxFiles} images</p>

      {value.length > 0 || uploading.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((url, i) => (
            <li
              key={`${url}-${i}`}
              draggable={!disabled && uploading.length === 0}
              onDragStart={onThumbDragStart(i)}
              onDragOver={onThumbDragOver}
              onDrop={onThumbDrop(i)}
              onDragEnd={onThumbDragEnd}
              className={cn(
                "relative h-20 w-20 overflow-hidden rounded-lg border border-[#2C2C2C]/10 bg-[#FAF8F4]",
                dragPhotoIndex === i && "ring-2 ring-[#6B9E6E]/80",
                !disabled && uploading.length === 0 && "cursor-grab active:cursor-grabbing",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              {i === 0 ? (
                <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  Main
                </span>
              ) : null}
              <button
                type="button"
                disabled={disabled || uploading.length > 0}
                onClick={() => removeAt(i)}
                className="absolute bottom-1 right-1 rounded-full bg-white/95 p-1 text-red-700 shadow hover:bg-red-50 disabled:opacity-50"
                aria-label="Remove image"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {uploading.map((u) => (
            <li
              key={u.id}
              className="relative flex h-20 w-20 flex-col overflow-hidden rounded-lg border border-[#6B9E6E]/40 bg-[#FAF8F4]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.preview} alt="" loading="lazy" className="h-14 w-full shrink-0 object-cover opacity-80" />
              <div className="flex flex-1 flex-col justify-center px-1 pb-1">
                <div className="h-1 w-full overflow-hidden rounded-full bg-[#EBE6DC]">
                  <div
                    className="h-full rounded-full bg-[#6B9E6E] transition-all duration-300"
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
                <span className="mt-0.5 truncate text-[9px] font-semibold text-[#2C2C2C]/60">{u.name}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {canAdd ? (
        <label
          htmlFor={inputId}
          aria-label="Choose images to upload or drop files here"
          onClick={(e) => e.stopPropagation()}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
            "bg-[#FAF8F4]",
            dragOver ? "border-[#6B9E6E] ring-2 ring-[#6B9E6E]/20" : "border-[#2C2C2C]/20 hover:border-[#6B9E6E]/50",
            (disabled || uploading.length > 0) && "pointer-events-none opacity-60",
          )}
        >
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            disabled={disabled || uploading.length > 0}
            onChange={onPick}
          />
          {uploading.length > 0 ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-[#6B9E6E]" />
              <span className="text-xs font-semibold text-[#2C2C2C]/70">Uploading…</span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[#2C2C2C]/70">
                <Upload className="h-5 w-5" />
                <ImagePlus className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold text-[#2C2C2C]">Drop images here or click to browse</span>
              <span className="text-xs font-semibold text-[#2C2C2C]/45">
                {value.length}/{maxFiles} used
              </span>
            </>
          )}
        </label>
      ) : (
        <p className="text-xs font-semibold text-[#2C2C2C]/45">Maximum {maxFiles} images reached. Remove one to add more.</p>
      )}

      {localError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{localError}</p>
      ) : null}
    </div>
  );
}

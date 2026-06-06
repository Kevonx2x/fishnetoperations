"use client";

import { Camera, ImageIcon, Loader2, Paperclip, Send, Smile, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { uploadMessengerImageToCloudinary } from "@/lib/upload-messenger-image-cloudinary";
import type { MessengerSendPayload } from "../types";

const ACCEPT = "image/jpeg,image/png,image/webp";

type Props = {
  onSend?: (payload: MessengerSendPayload) => void;
};

type PendingImage = {
  file: File;
  previewUrl: string;
};

export function Composer({ onSend }: Props) {
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const clearPendingImage = useCallback(() => {
    setPendingImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pendingImage?.previewUrl) URL.revokeObjectURL(pendingImage.previewUrl);
    };
  }, [pendingImage?.previewUrl]);

  const handleFilePick = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const mime = (file.type || "").toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
        setError("Use JPG, PNG, or WEBP only.");
        return;
      }
      setError(null);
      clearPendingImage();
      setPendingImage({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    },
    [clearPendingImage],
  );

  const canSend = Boolean(draft.trim() || pendingImage) && !uploading;

  const handleSend = () => {
    if (!canSend) return;

    void (async () => {
      const text = draft.trim();
      setError(null);

      if (pendingImage) {
        setUploading(true);
        try {
          const attachmentUrl = await uploadMessengerImageToCloudinary(pendingImage.file);
          onSend?.({
            text: text || undefined,
            attachmentUrl,
          });
          setDraft("");
          clearPendingImage();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Upload failed.");
        } finally {
          setUploading(false);
        }
        return;
      }

      if (text) {
        onSend?.({ text });
        setDraft("");
      }
    })();
  };

  const openGallery = () => galleryInputRef.current?.click();
  const openCamera = () => cameraInputRef.current?.click();

  return (
    <footer className="shrink-0 touch-manipulation overscroll-none border-t border-[#2C2C2C]/8 bg-[#FAF8F4] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {pendingImage ? (
        <div className="mb-2 flex items-start gap-2">
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImage.previewUrl}
              alt="Attachment preview"
              className="h-16 w-16 rounded-lg border border-[#2C2C2C]/10 object-cover"
            />
            {uploading ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#2C2C2C]/40">
                <Loader2 className="h-5 w-5 animate-spin text-white" aria-label="Uploading" />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={clearPendingImage}
            disabled={uploading}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#888888] hover:bg-[#2C2C2C]/5 hover:text-[#2C2C2C] disabled:opacity-40"
            aria-label="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mb-2 text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <input
        ref={galleryInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          handleFilePick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFilePick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="flex items-end gap-1">
        <button
          type="button"
          onClick={openGallery}
          disabled={uploading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#888888] hover:bg-[#2C2C2C]/5 hover:text-[#2C2C2C] disabled:opacity-40"
          aria-label="Attach file"
        >
          <Paperclip className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={openGallery}
          disabled={uploading}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#888888] hover:bg-[#2C2C2C]/5 hover:text-[#2C2C2C] sm:flex disabled:opacity-40"
          aria-label="Add image"
        >
          <ImageIcon className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={openCamera}
          disabled={uploading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#888888] hover:bg-[#2C2C2C]/5 hover:text-[#2C2C2C] disabled:opacity-40"
          aria-label="Camera"
        >
          <Camera className="h-[18px] w-[18px]" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[#2C2C2C]/10 bg-white px-4 py-2 shadow-sm">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message…"
            disabled={uploading}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[#2C2C2C] outline-none placeholder:text-[#AAAAAA] disabled:opacity-60"
            aria-label="Message input"
          />
          <button
            type="button"
            className="shrink-0 text-[#888888] hover:text-[#D4A843]"
            aria-label="Emoji"
          >
            <Smile className="h-[18px] w-[18px]" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E] text-white transition hover:bg-[#5a8a5d] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          {uploading ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
          ) : (
            <Send className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
    </footer>
  );
}

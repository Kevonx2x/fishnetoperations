"use client";

import { Check, CheckCheck, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { MessengerMessage } from "../types";

type Props = {
  message: MessengerMessage;
};

export function MessageBubble({ message }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (message.dateDivider) {
    return (
      <div className="flex justify-center py-3" role="separator">
        <span className="rounded-full bg-[#2C2C2C]/[0.06] px-3 py-1 text-[11px] font-medium text-[#888888]">
          {message.dateDivider}
        </span>
      </div>
    );
  }

  const sent = message.sent;
  const attachmentUrl = message.attachmentUrl?.trim() || null;
  const hasText = Boolean(message.text?.trim());
  const hasImage = Boolean(attachmentUrl);

  return (
    <>
      <div
        className={cn("flex w-full min-w-0 px-3", sent ? "justify-end" : "justify-start")}
      >
        <div className={cn("flex max-w-[min(85%,20rem)] flex-col gap-1", sent && "items-end")}>
          <div
            className={cn(
              "text-[15px] leading-snug",
              hasImage && !hasText ? "p-1" : "px-3.5 py-2.5",
              sent
                ? "rounded-[18px] rounded-br-[4px] bg-[#6B9E6E] text-white"
                : "rounded-[18px] rounded-bl-[4px] border border-[#2C2C2C]/8 bg-white text-[#2C2C2C] shadow-[0_1px_2px_rgba(44,44,44,0.04)]",
            )}
          >
            {hasImage ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="block max-w-[240px] overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6B9E6E]/50"
                aria-label="View full size image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachmentUrl!}
                  alt={hasText ? "Message attachment" : "Photo"}
                  className="max-h-64 w-full max-w-[240px] object-cover"
                />
              </button>
            ) : null}
            {hasText ? (
              <p className={cn(hasImage && "mt-2 px-0.5")}>{message.text}</p>
            ) : null}
          </div>

          {message.reactions && message.reactions.length > 0 ? (
            <div
              className={cn(
                "flex flex-wrap gap-1",
                sent ? "-mt-1 mr-1 justify-end" : "-mt-1 ml-1 justify-start",
              )}
            >
              {message.reactions.map((r) => (
                <span
                  key={r.emoji}
                  className="inline-flex items-center gap-0.5 rounded-full border border-[#2C2C2C]/10 bg-[#FAF8F4] px-2 py-0.5 text-xs shadow-sm"
                >
                  <span>{r.emoji}</span>
                  {r.count > 1 ? (
                    <span className="text-[10px] font-medium text-[#888888]">{r.count}</span>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}

          <div
            className={cn(
              "flex items-center gap-1 px-0.5 text-[10px] text-[#888888]",
              sent && "flex-row-reverse",
            )}
          >
            <span>{message.time}</span>
            {sent ? (
              message.read ? (
                <CheckCheck className="h-3.5 w-3.5 text-[#6B9E6E]" aria-label="Read" />
              ) : (
                <Check className="h-3.5 w-3.5 text-[#888888]" aria-label="Sent" />
              )
            ) : null}
          </div>
        </div>
      </div>

      {lightboxOpen && attachmentUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C2C2C]/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Close image preview"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={attachmentUrl}
            alt="Full size attachment"
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}

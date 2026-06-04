"use client";

import { Camera, ImageIcon, Paperclip, Send, Smile } from "lucide-react";
import { useState } from "react";

type Props = {
  onSend?: (text: string) => void;
};

export function Composer({ onSend }: Props) {
  const [draft, setDraft] = useState("");

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    onSend?.(text);
    setDraft("");
  };

  return (
    <footer className="shrink-0 border-t border-[#2C2C2C]/8 bg-[#FAF8F4] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-1">
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#888888] hover:bg-[#2C2C2C]/5 hover:text-[#2C2C2C]"
          aria-label="Attach file"
        >
          <Paperclip className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#888888] hover:bg-[#2C2C2C]/5 sm:flex"
          aria-label="Add image"
        >
          <ImageIcon className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#888888] hover:bg-[#2C2C2C]/5 sm:flex"
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
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[#2C2C2C] outline-none placeholder:text-[#AAAAAA]"
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
          disabled={!draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E] text-white transition hover:bg-[#5a8a5d] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-[18px] w-[18px]" />
        </button>
      </div>
    </footer>
  );
}

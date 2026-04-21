"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";

export function CoListRequestModal({
  open,
  onClose,
  propertyTitle,
  onSubmit,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  propertyTitle: string;
  onSubmit: (message: string) => void | Promise<void>;
  submitting?: boolean;
  error?: string | null;
}) {
  const [message, setMessage] = useState("");

  const helperText = useMemo(() => {
    const trimmed = message.trim();
    if (!trimmed) return "Add a short note to the listing agent (optional).";
    if (trimmed.length < 10) return "Tip: Add a bit more detail to improve your chances.";
    return "This message will be sent to the listing agent.";
  }, [message]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="co-list-request-title"
        className="relative z-[251] w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-2 text-[#2C2C2C]/60 hover:bg-black/5 hover:text-[#2C2C2C]"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <h2 id="co-list-request-title" className="font-serif text-lg font-bold leading-snug text-[#2C2C2C]">
          Request to Co-list
        </h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#2C2C2C]/75">
          Send a co-list request for <span className="text-[#2C2C2C]">{propertyTitle}</span>.
        </p>

        <label className="mt-4 block text-xs font-semibold text-[#2C2C2C]/55">
          Message (optional)
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="mt-1 w-full resize-none rounded-xl border border-[#2C2C2C]/15 px-3 py-2 text-sm font-semibold text-[#2C2C2C] outline-none focus:border-[#6B9E6E]/45 focus:ring-2 focus:ring-[#6B9E6E]/20"
            placeholder="Introduce yourself, your brokerage, and why you’d be a good co-listing agent…"
          />
        </label>
        <p className="mt-2 text-xs font-semibold text-[#2C2C2C]/50">{helperText}</p>

        {error ? <p className="mt-3 text-xs font-semibold text-red-700">{error}</p> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full border border-[#2C2C2C]/15 px-4 py-2 text-sm font-semibold text-[#2C2C2C]/75 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit(message)}
            disabled={submitting}
            className="rounded-full bg-[#2C2C2C] px-5 py-2 text-sm font-bold text-white hover:bg-[#6B9E6E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send request"}
          </button>
        </div>
      </div>
    </div>
  );
}


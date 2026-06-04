"use client";

import { Calendar, Loader2, MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  onMessageAgent: () => void;
  onScheduleViewing: () => void;
  messageBusy?: boolean;
  disabled?: boolean;
  messageDisabled?: boolean;
  scheduleDisabled?: boolean;
};

/** Fixed above marketplace bottom nav — Message agent + Schedule viewing. */
export function PropertyMobileStickyActions({
  onMessageAgent,
  onScheduleViewing,
  messageBusy = false,
  disabled = false,
  messageDisabled = false,
  scheduleDisabled = false,
}: Props) {
  return (
    <div
      className="w-full shrink-0 border-t border-black/[0.06] bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      role="group"
      aria-label="Property actions"
    >
      <div className="mx-auto flex max-w-lg gap-2.5 px-4 py-2.5">
        <button
          type="button"
          onClick={onMessageAgent}
          disabled={disabled || messageDisabled || messageBusy}
          className={cn(
            "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[#2C2C2C]/15 bg-white px-3 text-sm font-semibold text-[#6B9E6E] shadow-sm transition active:bg-[#FAF8F4] disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {messageBusy ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <MessageCircle className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          )}
          Message agent
        </button>
        <button
          type="button"
          onClick={onScheduleViewing}
          disabled={disabled || scheduleDisabled}
          className={cn(
            "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#6B9E6E] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5d8a60] active:bg-[#548a58] disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <Calendar className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          Schedule viewing
        </button>
      </div>
    </div>
  );
}

"use client";

import { WifiOff } from "lucide-react";

type HomepageListingsLoadErrorProps = {
  onRetry: () => void;
  retrying?: boolean;
};

export function HomepageListingsLoadError({ onRetry, retrying }: HomepageListingsLoadErrorProps) {
  return (
    <div className="rounded-xl border border-[#2C2C2C]/10 bg-white p-6 text-center shadow-sm sm:text-left">
      <WifiOff className="mx-auto size-8 text-[#888888] sm:mx-0" strokeWidth={1.75} aria-hidden />
      <p className="mt-3 text-base font-semibold text-[#2C2C2C]">Trouble loading listings</p>
      <p className="mt-1 text-[13px] font-medium text-[#888888]">Check your connection and tap to retry</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="mt-4 inline-flex h-11 min-w-[7.5rem] items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}

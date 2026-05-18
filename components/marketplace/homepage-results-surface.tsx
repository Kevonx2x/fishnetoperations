"use client";

import { Search } from "lucide-react";

export function HomepageExpandSearchCta({
  message,
  onExpand,
}: {
  message: string;
  onExpand: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6B9E6E]/12 text-[#6B9E6E]">
          <Search className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-sm font-medium leading-relaxed text-[#2C2C2C]/75">{message}</p>
      </div>
      <button
        type="button"
        onClick={onExpand}
        className="shrink-0 rounded-full border-2 border-[#6B9E6E] bg-white px-5 py-2.5 text-sm font-semibold text-[#6B9E6E] transition hover:bg-[#6B9E6E]/5"
      >
        Expand search
      </button>
    </div>
  );
}

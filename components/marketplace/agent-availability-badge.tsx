"use client";

/** Always show availability: green dot + text when set, otherwise grey “Status Unknown”. */
export function AgentAvailabilityBadge({ availability }: { availability: string }) {
  const trimmed = availability?.trim() ?? "";
  if (!trimmed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2C2C2C]/45">
        Status Unknown
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6B9E6E]">
      <span className="h-2 w-2 shrink-0 rounded-full bg-[#6B9E6E]" aria-hidden />
      {trimmed}
    </span>
  );
}

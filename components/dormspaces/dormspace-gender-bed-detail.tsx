import {
  formatGenderBedDetailBlock,
  formatGenderBedPriceLine,
} from "@/lib/dormspace-gender-beds";
import type { DormspaceRow } from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

export function DormspaceGenderBedDetail({
  listing,
  className,
}: {
  listing: Pick<DormspaceRow, keyof DormspaceRow>;
  className?: string;
}) {
  const { open, full } = formatGenderBedDetailBlock(listing);

  if (open.length === 0 && full.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">Beds & pricing</h2>
      {open.length > 0 ? (
        <ul className="space-y-2">
          {open.map((line) => (
            <li
              key={line.gender}
              className="rounded-xl border border-[#6B9E6E]/25 bg-[#6B9E6E]/8 px-4 py-3 text-sm font-semibold text-[#2C2C2C]"
            >
              {formatGenderBedPriceLine(line)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] px-4 py-3 text-sm font-semibold text-[#888888]">
          No beds available right now.
        </p>
      )}
      {full.length > 0 ? (
        <p className="text-xs font-medium text-[#888888]">
          {full.map((f) => `${f.gender} (${f.total} ${f.total === 1 ? "bed" : "beds"}) — full`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

import {
  dormspaceBedAvailability,
  type DormspaceRow,
} from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

type Props = {
  listing: Pick<DormspaceRow, "room_type" | "total_beds" | "available_beds">;
  /** inline = "Room · 2 available"; badge = full/all chips; detail = larger block */
  variant?: "inline" | "badge" | "detail";
  className?: string;
};

export function DormspaceBedAvailability({ listing, variant = "inline", className }: Props) {
  const info = dormspaceBedAvailability(listing);

  if (variant === "badge") {
    if (info.status === "full") {
      return (
        <span
          className={cn(
            "rounded-full bg-[#2C2C2C]/8 px-2.5 py-1 text-[11px] font-semibold text-[#888888]",
            className,
          )}
        >
          Currently full
        </span>
      );
    }
    if (info.status === "all") {
      return (
        <span
          className={cn(
            "rounded-full bg-[#6B9E6E]/12 px-2.5 py-1 text-[11px] font-bold text-[#4a7a4d]",
            className,
          )}
        >
          All beds available
        </span>
      );
    }
    return (
      <span
        className={cn(
          "rounded-full bg-[#6B9E6E]/12 px-2.5 py-1 text-[11px] font-bold text-[#4a7a4d]",
          className,
        )}
      >
        {info.shortLine}
      </span>
    );
  }

  if (variant === "detail") {
    return (
      <div className={cn("mt-3 flex flex-wrap items-center gap-2", className)}>
        <p className="text-sm font-bold text-[#2C2C2C]">{info.detailLine}</p>
        <DormspaceBedAvailability listing={listing} variant="badge" />
      </div>
    );
  }

  return (
    <span className={cn("text-[11px] font-medium text-[#6B6B6B]", className)}>
      {info.detailLine}
    </span>
  );
}

import { Bookmark, Heart } from "lucide-react";

import { cn } from "@/lib/utils";

function StatBadge({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Heart;
  label: string;
  count: number;
}) {
  const display = count > 0 ? String(count) : "—";
  return (
    <span
      title={label}
      className="inline-flex items-center gap-1 text-xs font-medium text-[#888888]"
    >
      <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden />
      <span className="tabular-nums">{display}</span>
    </span>
  );
}

export function DormspaceListingEngagementStats({
  likeCount,
  saveCount,
  className,
}: {
  likeCount: number;
  saveCount: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <StatBadge icon={Heart} label="Likes" count={likeCount} />
      <StatBadge icon={Bookmark} label="Saves" count={saveCount} />
    </div>
  );
}

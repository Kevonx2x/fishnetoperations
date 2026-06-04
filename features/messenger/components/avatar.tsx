import { cn } from "@/lib/utils";

type Props = {
  initials: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  className?: string;
};

const sizeMap = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-xs",
  lg: "h-12 w-12 text-sm",
};

export function MessengerAvatar({ initials, size = "md", online, className }: Props) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-[#E8E6E1] font-semibold text-[#5C5C5C]",
          sizeMap[size],
        )}
        aria-hidden
      >
        {initials}
      </div>
      {online !== undefined ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-[#FAF8F4]",
            online ? "bg-[#6B9E6E]" : "bg-[#CCCCCC]",
          )}
          aria-label={online ? "Online" : "Offline"}
        />
      ) : null}
    </div>
  );
}

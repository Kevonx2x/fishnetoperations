"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  initials: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  online?: boolean;
  className?: string;
};

const sizeMap = {
  sm: "h-9 w-9 text-[11px]",
  md: "h-11 w-11 text-xs",
  lg: "h-12 w-12 text-sm",
};

export function MessengerAvatar({
  initials,
  imageUrl,
  size = "md",
  online,
  className,
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const url = imageUrl?.trim() ?? "";

  useEffect(() => {
    setImageFailed(false);
  }, [url]);

  const showImage = Boolean(url) && !imageFailed;

  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-full bg-[#E8E6E1]",
          sizeMap[size],
          !showImage && "flex items-center justify-center font-semibold text-[#5C5C5C]",
        )}
        aria-hidden={showImage}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          initials
        )}
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

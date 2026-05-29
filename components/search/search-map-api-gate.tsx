"use client";

import { useApiIsLoaded } from "@vis.gl/react-google-maps";

import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Cream placeholder while vis.gl APIProvider initializes the Maps JS API. */
export function SearchMapApiGate({ children, className }: Props) {
  const apiLoaded = useApiIsLoaded();

  if (!apiLoaded) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center bg-[#FAF8F4]",
          className,
        )}
      >
        <p className="font-sans text-sm text-[#888888]">Loading map…</p>
      </div>
    );
  }

  return <>{children}</>;
}

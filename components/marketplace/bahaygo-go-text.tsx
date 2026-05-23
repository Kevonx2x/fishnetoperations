"use client";

import { useEffect, useState } from "react";
import { useBahayGoGoGlow } from "@/contexts/bahaygo-go-glow-context";
import { cn } from "@/lib/utils";

const GLOW_MS = 1000;

type Props = {
  className?: string;
  children?: React.ReactNode;
};

function BahayGoGoTextPulse({ className, children }: Props) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDone(true), GLOW_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <span
      className={cn(
        "inline-block",
        done ? "text-[#6B9E6E]" : "bahaygo-go-neon-glow",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Sage "go" wordmark slice — neon sweep on load and each client route change. */
export function BahayGoGoText({ className, children = "go" }: Props) {
  const { glowGeneration } = useBahayGoGoGlow();

  return (
    <BahayGoGoTextPulse key={glowGeneration} className={className}>
      {children}
    </BahayGoGoTextPulse>
  );
}

"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { MobileBottomNav } from "@/components/mobile/mobile-bottom-nav";
import { cn } from "@/lib/utils";

/** Wraps page content with mobile bottom-nav clearance and mounts global mobile nav. */
export function MobileLayoutChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <div className={cn("flex min-h-0 flex-1 flex-col", "pb-[80px] md:pb-0")}>{children}</div>
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </>
  );
}

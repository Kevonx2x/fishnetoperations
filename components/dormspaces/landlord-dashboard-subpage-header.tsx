"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  backHref?: string;
  backLabel?: string;
  className?: string;
  children?: ReactNode;
};

export function LandlordDashboardSubpageHeader({
  title,
  backHref = "/dormspaces/dashboard",
  backLabel = "Dashboard",
  className,
  children,
}: Props) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-black/[0.06] bg-[#FAF8F4]/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm md:static md:z-auto",
        className,
      )}
    >
      <div className="mx-auto max-w-5xl px-4 py-3">
        <Link
          href={backHref}
          className="mb-2 inline-flex min-h-10 items-center gap-1 rounded-lg pr-2 text-sm font-semibold text-[#6B9E6E] transition-colors hover:text-[#5d8a60] active:opacity-80"
        >
          <ChevronLeft className="size-5 shrink-0" aria-hidden />
          {backLabel}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-serif text-[28px] font-semibold leading-tight text-[#2C2C2C]">{title}</h1>
          {children ? <div className="shrink-0 pt-1">{children}</div> : null}
        </div>
      </div>
    </header>
  );
}

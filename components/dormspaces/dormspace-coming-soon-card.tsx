"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Home } from "lucide-react";

import { cn } from "@/lib/utils";

export function DormspaceComingSoonCard({ cardWidthClass }: { cardWidthClass: string }) {
  return (
    <motion.div
      className="shrink-0"
      animate={{ opacity: [0.88, 1, 0.88] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <Link
        href="/dormspaces/submit"
        className={cn(
          "flex min-h-[412px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#6B9E6E] bg-[#FAF8F4] px-4 py-8 text-center shadow-sm transition hover:bg-[#F4F1EA] lg:min-h-[448px]",
          cardWidthClass,
        )}
      >
        <Home className="mb-3 h-11 w-11 text-[#6B9E6E]" strokeWidth={1.5} aria-hidden />
        <p className="font-serif text-base font-semibold text-[#2C2C2C]">More dormspaces coming soon</p>
        <p className="mt-2 text-sm font-semibold text-[#6B9E6E]">List your bedspace here →</p>
      </Link>
    </motion.div>
  );
}

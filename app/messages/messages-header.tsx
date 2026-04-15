"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function MessagesHeader() {
  const router = useRouter();

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-[#E5E5E5] bg-white px-4 py-3">
      <button type="button" onClick={() => router.back()} className="p-1" aria-label="Back">
        <ArrowLeft className="h-5 w-5 text-[#2C2C2C]" />
      </button>
      <span className="font-serif text-xl font-semibold text-[#2C2C2C]">Messages</span>
    </header>
  );
}

"use client";

import Link from "next/link";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <MaddenTopNav />
      <main className="mx-auto max-w-3xl px-4 pt-10 pb-12">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/55">Blog</p>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">Fishnet Blog</h1>
        <p className="mt-3 text-sm font-semibold text-[#2C2C2C]/60">
          Coming soon. For now, browse verified listings and agents.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-[#2C2C2C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#7C9A7E]"
        >
          Back to home →
        </Link>
      </main>
    </div>
  );
}


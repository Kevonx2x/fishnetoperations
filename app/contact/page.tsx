"use client";

import Link from "next/link";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <MaddenTopNav />
      <main className="mx-auto max-w-3xl px-4 pt-10 pb-12">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/55">Contact</p>
        <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">Contact BahayGo</h1>
        <p className="mt-3 text-sm font-semibold text-[#2C2C2C]/60">
          Coming soon. If you’re an agent or broker, use the registration flow in the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/register/agent"
            className="inline-flex rounded-full bg-[#2C2C2C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#7C9A7E]"
          >
            Register as agent →
          </Link>
          <Link
            href="/register/broker"
            className="inline-flex rounded-full border border-black/10 bg-white px-6 py-2.5 text-sm font-semibold text-[#2C2C2C]/80 hover:bg-[#FAF8F4]"
          >
            Register as broker →
          </Link>
        </div>
      </main>
    </div>
  );
}


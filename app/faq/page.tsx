"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { cn } from "@/lib/utils";

const FAQ_ITEMS = [
  {
    question: "Can foreigners buy property in the Philippines?",
    answer:
      "Foreign nationals cannot own land in the Philippines but can own condominium units as long as foreign ownership in the building does not exceed 40 percent. They can also own structures built on leased land.",
  },
  {
    question: "What is a CRDO?",
    answer:
      "A Condominium Real Estate Developer and Owner. They are responsible for developing and managing condominium projects in the Philippines.",
  },
  {
    question: "What taxes apply when buying property in the Philippines?",
    answer:
      "Buyers typically pay Documentary Stamp Tax of 1.5 percent, Transfer Tax of 0.5 to 0.75 percent, Registration Fee of approximately 0.25 percent, and notarial fees. Sellers pay Capital Gains Tax of 6 percent.",
  },
  {
    question: "What is a PRC licensed real estate broker?",
    answer:
      "A licensed professional regulated by the Professional Regulation Commission who is legally authorized to facilitate real estate transactions in the Philippines. All agents on BahayGo are PRC verified.",
  },
  {
    question: "What is the difference between a condo and a house and lot?",
    answer:
      "A condominium unit is individual ownership of a unit within a shared building. A house and lot is ownership of both the structure and the land it sits on. Foreigners can own condos but not land.",
  },
  {
    question: "What is a preselling property?",
    answer:
      "A property sold before construction is complete. Buyers typically get lower prices but wait 2 to 5 years for turnover. BahayGo lists both preselling and ready for occupancy properties.",
  },
  {
    question: "How does BahayGo verify agents?",
    answer:
      "All agents on BahayGo submit their PRC license number, a selfie with their ID, and go through admin approval before being listed. You can identify verified agents by the Verified badge on their profile.",
  },
  {
    question: "Can I rent instead of buy as a foreigner?",
    answer:
      "Yes. Foreigners can freely rent property in the Philippines with no restrictions. Long term leases of up to 50 years renewable for another 25 years are available.",
  },
  {
    question: "What is an RFO property?",
    answer:
      "Ready For Occupancy. A property that is completed and can be moved into immediately after purchase or lease signing.",
  },
  {
    question: "What visa do I need to buy a condo in the Philippines?",
    answer:
      "No specific visa is required to purchase a condo. However you must be physically present or have a legal representative to sign documents. Many buyers use a Special Power of Attorney.",
  },
] as const;

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-16 font-sans text-[#2C2C2C]">
      <MaddenTopNav />

      <main className="mx-auto max-w-3xl px-4 pt-10 sm:pt-14">
        <header className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#6B9E6E]">Help center</p>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] sm:text-4xl">
            Frequently Asked Questions
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm font-medium leading-relaxed text-[#2C2C2C]/70 sm:text-base">
            Everything you need to know about buying and renting property in the Philippines as a
            foreigner.
          </p>
        </header>

        <div className="mt-12 rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-2 shadow-sm sm:px-6">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.question} className="border-b border-gray-200 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenIndex((prev) => (prev === index ? null : index))}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-base font-semibold text-[#2C2C2C] sm:py-5"
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0">{item.question}</span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-[#6B9E6E] transition-transform duration-200",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-in-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="pb-4 text-sm leading-relaxed text-[#2C2C2C]/70">{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-[#6B9E6E]/25 bg-[#6B9E6E]/8 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-[#2C2C2C]/80">Still have questions?</p>
          <a
            href="mailto:support@bahaygo.com"
            className="inline-flex rounded-full bg-[#6B9E6E] px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5d8a60]"
          >
            Contact Us
          </a>
          <Link href="/" className="text-sm font-semibold text-[#6B9E6E] underline-offset-2 hover:underline">
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const DORMSPACE_HOMEPAGE_FAQ_ITEMS = [
  {
    question: "How does BahayGo verify dorm listings?",
    answer:
      "Landlords submit a valid ID and proof of address. Our team reviews each dormspace before it goes live with a verified badge, so you are not relying on random Facebook posts.",
  },
  {
    question: "What is the difference between a bedspace and a private room?",
    answer:
      "A bedspace is a shared room where you rent one bed. A private room is your own room within a dorm or coliving house. Both are listed with bed counts, gender rules, and amenities up front.",
  },
  {
    question: "How do I contact a landlord?",
    answer:
      "Open a listing and use the contact options on the page. Dormspacers connects you directly with the landlord — no in-platform messaging required.",
  },
  {
    question: "Is it free to list my dorm or bedspace?",
    answer:
      "Yes. Listing on BahayGo dormspacers is free for landlords. Create an account, submit your space for review, and manage inquiries from your landlord dashboard.",
  },
  {
    question: "Can I save listings to compare later?",
    answer:
      "Yes. Sign in and tap the heart on any listing to save it. View all saved dormspaces anytime from Saved in the nav or /dormspaces/liked.",
  },
] as const;

export function DormspaceHomepageFaqSection({ className }: { className?: string }) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  return (
    <section
      className={cn("mx-auto max-w-3xl px-4 pb-12 sm:px-5", className)}
      aria-labelledby="dormspace-homepage-faq-heading"
    >
      <h2
        id="dormspace-homepage-faq-heading"
        className="text-center font-serif text-2xl font-semibold tracking-tight text-[#2C2C2C] md:text-3xl"
      >
        Frequently Asked Questions
      </h2>
      <p className="mt-2 text-center text-sm font-medium text-[#404040]">
        Common questions about finding and listing student housing on dormspacers.
      </p>
      <div className="mt-8">
        {DORMSPACE_HOMEPAGE_FAQ_ITEMS.map((item, index) => {
          const isOpen = openFaqIndex === index;
          return (
            <div key={item.question} className="border-b border-gray-200">
              <button
                type="button"
                onClick={() => setOpenFaqIndex((prev) => (prev === index ? null : index))}
                className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left text-base font-medium text-[#2C2C2C]"
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
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
                  <p className="pb-4 text-sm leading-relaxed text-[#404040]">{item.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8 flex justify-center">
        <Link
          href="/faq"
          className="inline-flex rounded-full border-2 border-[#6B9E6E] bg-white px-6 py-2.5 text-sm font-semibold text-[#6B9E6E] shadow-sm transition hover:bg-[#6B9E6E]/10"
        >
          View all FAQs
        </Link>
      </div>
    </section>
  );
}

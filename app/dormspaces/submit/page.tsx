import Link from "next/link";
import { Suspense } from "react";

import { DormspaceSubmitForm } from "@/components/dormspaces/dormspace-submit-form";
import { DormspaceSubmitGate } from "@/components/dormspaces/dormspace-submit-gate";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";

export const metadata = {
  title: "List your dormspace | BahayGo",
  description: "Submit your bedspace or coliving listing for review on BahayGo Dormspaces.",
};

export default function DormspaceSubmitPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <MaddenTopNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8">
        <div className="mb-8 text-center md:mb-10">
          <Link href="/dormspaces" className="text-sm font-semibold text-[#6B9E6E] hover:underline">
            ← Back to Dormspaces
          </Link>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] md:text-4xl">
            List your dormspace
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-[#484848]">
            Free to list. We verify every landlord with ID and proof of billing before your listing goes live.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="flex min-h-[240px] items-center justify-center">
              <p className="text-sm font-medium text-[#484848]">Loading…</p>
            </div>
          }
        >
          <DormspaceSubmitGate>
            <DormspaceSubmitForm />
          </DormspaceSubmitGate>
        </Suspense>
      </main>
    </div>
  );
}

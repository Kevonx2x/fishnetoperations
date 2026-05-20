import Link from "next/link";

import { DormspaceTrustStrip } from "@/components/dormspaces/dormspace-trust-strip";
import { BahayGoWordmarkHomeLink } from "@/components/marketplace/bahaygo-wordmark";

export const metadata = {
  title: "List your dormspace | BahayGo",
  description:
    "Free to list. Verified landlords only. Reach students, BPO workers, and young professionals across Metro Manila.",
};

export default function DormspaceWelcomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF8F4]">
      <header className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex justify-center">
          <BahayGoWordmarkHomeLink size="nav" />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-12 sm:px-6">
        <section className="text-center">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] md:text-4xl">
            List your dormspace on BahayGo
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-relaxed text-[#484848]">
            Free to list. Verified landlords only. Reach students, BPO workers, and young professionals
            across Metro Manila.
          </p>
        </section>

        <DormspaceTrustStrip />

        <div className="mx-auto mt-10 flex w-full max-w-md flex-col gap-3 sm:max-w-lg sm:flex-row sm:gap-4">
          <Link
            href="/dormspaces/submit?from=welcome"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-[#6B9E6E] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60]"
          >
            Create a landlord account
          </Link>
          <Link
            href="/auth/login?redirect=/dormspaces/dashboard"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-[#2C2C2C]/15 bg-white px-6 text-sm font-bold text-[#2C2C2C] shadow-sm transition hover:border-[#6B9E6E]/40 hover:bg-[#FAF8F4]"
          >
            Sign in to existing landlord account
          </Link>
        </div>

        <p className="mx-auto mt-6 max-w-md text-center text-xs font-medium text-[#888888]">
          Already submitted a dormspace? Sign in above to manage your listings.
        </p>
      </main>

      <footer className="mt-auto border-t border-[#2C2C2C]/8 bg-[#FAF8F4]">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-8 sm:px-6">
          <BahayGoWordmarkHomeLink size="sidebar" />
          <Link href="/" className="text-sm font-semibold text-[#6B9E6E] hover:underline">
            Back to BahayGo
          </Link>
        </div>
      </footer>
    </div>
  );
}

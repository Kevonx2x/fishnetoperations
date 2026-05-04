import Image from "next/image";
import Link from "next/link";
import { GitBranch, Home } from "lucide-react";

const forest = "#1a3d2c";
const forestMuted = "#3d5a4a";

/**
 * Featured hero band — strong vertical mass, wide padding, visible illustration rail (placeholder ok).
 */
export function ClientDashboardContinueCard() {
  return (
    <section
      className="flex w-full min-h-0 flex-col rounded-2xl bg-[#F6F9F6] shadow-none ring-1 ring-[#2C2C2C]/[0.045]"
      aria-labelledby="client-dashboard-continue-heading"
    >
      <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-6 px-6 py-6 text-left sm:gap-8 sm:px-8 sm:py-7 md:gap-8 lg:grid-cols-[3fr_2fr] lg:items-stretch lg:gap-8 lg:px-10 lg:py-7 xl:px-12">
        {/* LEFT — 60% */}
        <div className="flex min-w-0 flex-col justify-center gap-0 lg:py-0">
          <h1
            id="client-dashboard-continue-heading"
            className="font-serif text-3xl font-bold leading-[1.05] tracking-tight text-balance sm:text-4xl lg:text-[2.35rem] lg:leading-[1.05]"
            style={{ color: forest }}
          >
            Pick up where you left off
          </h1>
          <p
            className="mt-4 max-w-2xl text-base leading-relaxed sm:text-lg lg:mt-5"
            style={{ color: forestMuted }}
          >
            Continue your home search, track deals, or check new updates.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <Link
              href="/dashboard/client/pipeline"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2.5 rounded-xl px-8 text-base font-semibold text-white transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a3d2c]/40 sm:min-w-[12rem]"
              style={{ backgroundColor: forest }}
            >
              <GitBranch className="size-[1.125rem] shrink-0 text-white" aria-hidden />
              View My Pipeline
            </Link>
            <Link
              href="/"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2.5 rounded-xl border-2 border-[#6B9E6E]/60 bg-transparent px-8 text-base font-semibold text-[#4a7a4d] transition hover:border-[#6B9E6E] hover:bg-[#6B9E6E]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B9E6E]/35 sm:min-w-[12rem]"
            >
              <Home className="size-[1.125rem] shrink-0 text-[#6B9E6E]" aria-hidden />
              Browse New Listings
            </Link>
          </div>
        </div>

        {/* RIGHT — 40%: always reads as real space; drop image inside when ready */}
        <div
          className="illustration-container relative flex min-h-[140px] w-full min-w-0 shrink-0 flex-col items-center justify-center self-stretch overflow-hidden rounded-2xl p-4 sm:min-h-[160px] sm:p-5 lg:min-h-[180px] lg:justify-end lg:rounded-3xl lg:p-5"
          aria-label="Illustration area"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#c5d9c8]/25 via-[#e4ede5]/85 to-[#f0f5f1]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: `radial-gradient(ellipse 85% 70% at 75% 45%, rgba(107, 158, 110, 0.12), transparent 55%)`,
            }}
            aria-hidden
          />
          <div className="relative z-[1] flex h-full min-h-[120px] w-full flex-1 items-center justify-center p-3 sm:min-h-[130px] sm:p-4 lg:min-h-[140px]">
            <Image
              src="/agent-illustration.png"
              alt=""
              fill
              className="object-contain object-center"
              sizes="(min-width: 1024px) 320px, 100vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

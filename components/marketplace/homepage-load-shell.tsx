import { HOMEPAGE_INITIAL_CATEGORY_ROWS } from "@/lib/homepage-row-templates";
import { HOMEPAGE_BROWSE_LISTING_CARD_WIDTH } from "@/lib/homepage-listing-card-layout";

/** Neutral pulse blocks — layout only, no copy. */
function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-[#2C2C2C]/8 ${className}`} aria-hidden />;
}

const MOBILE_LISTING_CARD_SKELETON_WIDTH =
  "w-[280px] shrink-0 sm:w-[232px] lg:w-[240px]";

/** Horizontal listing row skeleton matching RowCarousel card widths. */
export function HomepageListingRowsSkeleton({ rows = HOMEPAGE_INITIAL_CATEGORY_ROWS }: { rows?: number }) {
  return (
    <div className="min-w-0 w-full max-w-full space-y-4 overflow-x-hidden md:space-y-6" aria-hidden>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`listing-row-skel-${rowIdx}`} className="min-w-0 w-full">
          <Pulse className="h-8 w-48 max-w-[70%]" />
          <Pulse className="mt-2 h-4 w-56 max-w-[55%]" />
          <div className="-mx-4 mt-3 min-w-0 w-full overflow-x-auto scroll-pl-4 scroll-pr-4 pb-2 scrollbar-hide md:mx-0 md:scroll-pl-0 md:scroll-pr-0">
            <div className="flex w-max flex-nowrap gap-2 px-4 md:gap-3 md:px-0">
              {Array.from({ length: 4 }).map((_, cardIdx) => (
                <div
                  key={`listing-card-skel-${rowIdx}-${cardIdx}`}
                  className={`${MOBILE_LISTING_CARD_SKELETON_WIDTH} overflow-hidden rounded-xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.1)] md:rounded-2xl md:border md:border-[#2C2C2C]/10 md:shadow-md`}
                >
                  <div className="aspect-[20/19] w-full bg-[#2C2C2C]/8 md:aspect-auto md:h-44 lg:h-52" />
                  <div className="space-y-2 p-2.5 md:p-3">
                    <Pulse className="h-4 w-3/4" />
                    <Pulse className="h-4 w-1/2" />
                    <Pulse className="mt-2 h-10 w-full rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {rowIdx < rows - 1 ? (
            <hr className="mx-auto my-3 w-3/4 border-t border-[#2C2C2C]/10" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function HomepageFaqSectionSkeleton() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12" aria-hidden>
      <Pulse className="mx-auto h-9 w-64" />
      <Pulse className="mx-auto mt-3 h-4 w-80 max-w-full" />
      <div className="mt-8 space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={`faq-skel-${i}`} className="rounded-xl border border-[#2C2C2C]/10 bg-white px-4 py-4">
            <Pulse className="h-5 w-full max-w-md" />
          </div>
        ))}
      </div>
      <Pulse className="mx-auto mt-8 h-10 w-40 rounded-full" />
    </section>
  );
}

export function HomepageTopAgentsSectionSkeleton() {
  return (
    <section className="mt-12" aria-hidden>
      <Pulse className="h-9 w-72 max-w-[90%]" />
      <Pulse className="mt-2 h-4 w-64 max-w-[80%]" />
      <div className="mt-4 flex gap-4 overflow-hidden pb-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={`agent-skel-${i}`}
            className="w-[180px] shrink-0 rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm lg:w-[300px]"
          >
            <div className="mx-auto h-14 w-14 rounded-full bg-[#2C2C2C]/8" />
            <Pulse className="mx-auto mt-3 h-4 w-24" />
            <Pulse className="mx-auto mt-2 h-3 w-32" />
            <Pulse className="mt-4 h-9 w-full rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Initial paint shell for `/` — reserves viewport space before client bundle hydrates.
 * Matches mobile homepage structure (nav, hero, locations, listing rows).
 */
export function HomepageLoadShell() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAF8F4]" aria-busy="true" aria-label="Loading homepage">
      <div className="sticky top-0 z-50 w-full border-b border-black/[0.06] bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4">
          <Pulse className="h-8 w-24" />
          <Pulse className="h-9 w-9 rounded-full" />
        </div>
      </div>

      <section className="w-full border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
        <div className="w-full px-4 py-6 md:mx-auto md:max-w-7xl md:py-8">
          <Pulse className="mx-auto h-3 w-56 md:mx-0" />
          <p className="mt-3 w-full text-center text-sm font-normal text-[#2C2C2C] md:hidden">
            Find verified homes in Metro Manila
          </p>
          <div className="mx-auto mt-4 w-full rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm md:max-w-none">
            <Pulse className="h-12 w-full rounded-2xl" />
          </div>
        </div>
      </section>

      <section className="w-full overflow-x-hidden border-b border-[#2C2C2C]/10 py-6 md:py-8">
        <div className="w-full px-4 md:mx-auto md:max-w-7xl">
          <Pulse className="mx-auto h-8 w-48 sm:mx-0" />
          <Pulse className="mx-auto mt-2 h-4 w-40 sm:mx-0" />
          <div className="-mx-4 mt-4 flex min-w-0 gap-3 overflow-x-auto pb-2 scrollbar-hide md:mx-0">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={`loc-skel-${i}`}
                className="h-[110px] w-[130px] shrink-0 overflow-hidden rounded-2xl border border-[#2C2C2C]/10 lg:h-[130px] lg:w-[160px]"
              >
                <div className="h-full w-full bg-[#2C2C2C]/8" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto min-w-0 w-full max-w-7xl overflow-x-hidden px-4 pb-28 pt-4 md:px-6 md:pb-16 md:pt-10">
        <HomepageListingRowsSkeleton />
      </main>
    </div>
  );
}

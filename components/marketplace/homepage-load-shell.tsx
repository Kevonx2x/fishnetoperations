import { HOMEPAGE_INITIAL_CATEGORY_ROWS } from "@/lib/homepage-row-templates";

/** Neutral pulse blocks — layout only, no copy. */
function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-[#2C2C2C]/8 ${className}`} aria-hidden />;
}

/** Horizontal listing row skeleton matching RowCarousel card widths. */
export function HomepageListingRowsSkeleton({ rows = HOMEPAGE_INITIAL_CATEGORY_ROWS }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-hidden>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={`listing-row-skel-${rowIdx}`}>
          <Pulse className="h-8 w-48 max-w-[70%]" />
          <Pulse className="mt-2 h-4 w-56 max-w-[55%]" />
          <div className="mt-3 flex gap-3 overflow-hidden pb-2">
            {Array.from({ length: 4 }).map((_, cardIdx) => (
              <div
                key={`listing-card-skel-${rowIdx}-${cardIdx}`}
                className="w-[220px] shrink-0 overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-md sm:w-[232px] lg:w-[240px]"
              >
                <div className="h-44 w-full bg-[#2C2C2C]/8 lg:h-52" />
                <div className="space-y-2 p-3">
                  <Pulse className="h-4 w-3/4" />
                  <Pulse className="h-4 w-1/2" />
                  <Pulse className="mt-2 h-10 w-full rounded-xl" />
                </div>
              </div>
            ))}
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
    <div className="min-h-screen bg-[#FAF8F4]" aria-busy="true" aria-label="Loading homepage">
      <div className="sticky top-0 z-50 border-b border-[#2C2C2C]/10 bg-[#FAF8F4]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Pulse className="h-8 w-24" />
          <Pulse className="h-9 w-9 rounded-full" />
        </div>
      </div>

      <section className="border-b border-[#2C2C2C]/10 bg-[#FAF8F4]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
          <div className="text-center lg:text-left">
            <Pulse className="mx-auto h-3 w-56 lg:mx-0" />
            <Pulse className="mx-auto mt-4 h-10 w-[min(100%,20rem)] lg:mx-0 lg:h-12 lg:w-[28rem]" />
            <Pulse className="mx-auto mt-3 h-4 w-64 lg:mx-0" />
          </div>
          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm">
            <Pulse className="h-12 w-full rounded-2xl" />
          </div>
        </div>
      </section>

      <section className="border-b border-[#2C2C2C]/10 py-8">
        <div className="mx-auto max-w-7xl px-4">
          <Pulse className="mx-auto h-8 w-48 sm:mx-0" />
          <Pulse className="mx-auto mt-2 h-4 w-40 sm:mx-0" />
          <div className="mt-6 flex gap-3 overflow-hidden">
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

      <main className="mx-auto max-w-7xl px-6 pb-28 pt-10 md:pb-16">
        <HomepageListingRowsSkeleton />
      </main>
    </div>
  );
}

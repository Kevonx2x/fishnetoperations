import { Suspense } from "react";
import { ClientPipelineInner } from "@/components/client/client-pipeline-page";

export default function ClientDashboardPipelinePage() {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C] md:text-4xl">Pipeline</h1>
          <p className="mt-2 max-w-2xl font-sans text-sm font-medium leading-relaxed text-[#2C2C2C]/60 md:text-base">
            Track the progress of your properties and what&apos;s next in your journey.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[#2C2C2C]/12 bg-white px-4 py-2 font-sans text-sm font-bold text-[#2C2C2C]/80 hover:bg-[#FAF8F4]"
          aria-label="Filter pipeline deals"
        >
          <svg className="h-4 w-4 shrink-0 text-[#2C2C2C]/50" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 5h16M7 5v.01M6 9h12l-4 5v6l-4 2v-8L6 9z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Filter
        </button>
      </div>
      <div className="mt-8">
        <Suspense
          fallback={
            <div className="flex min-h-[200px] items-center justify-center text-sm text-[#2C2C2C]/50">
              Loading pipeline…
            </div>
          }
        >
          <ClientPipelineInner />
        </Suspense>
      </div>
    </>
  );
}

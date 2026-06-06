import { Suspense } from "react";
import { ClientPipelineInner } from "@/components/client/client-pipeline-page";

export default function ClientDashboardPipelinePage() {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[1.75rem] font-bold leading-tight tracking-tight text-[#2C2C2C] lg:text-4xl">
            Pipeline
          </h1>
          <p className="mt-1.5 max-w-2xl font-sans text-sm font-medium leading-relaxed text-[#2C2C2C]/60 lg:mt-2 lg:text-base">
            Track the progress of your properties and what&apos;s next in your journey.
          </p>
        </div>
      </div>
      <div className="mt-4 lg:mt-8">
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

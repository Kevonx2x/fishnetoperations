import { Suspense } from "react";
import { ClientPipelineInner } from "@/components/client/client-pipeline-page";

export default function ClientDashboardPipelinePage() {
  return (
    <>
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#2C2C2C] md:text-4xl">
        Pipeline
      </h1>
      <p className="mt-2 max-w-2xl text-sm font-medium text-[#888888] md:text-base">
        Track each property you&apos;re pursuing — viewings, documents, and next steps in one place.
      </p>
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

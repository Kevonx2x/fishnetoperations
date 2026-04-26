import { Suspense } from "react";
import { ClientPipelinePage } from "@/components/client/client-pipeline-page";

export default function ClientPipelineRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FAF8F4] text-sm font-semibold text-[#2C2C2C]/50">
          Loading…
        </div>
      }
    >
      <ClientPipelinePage />
    </Suspense>
  );
}

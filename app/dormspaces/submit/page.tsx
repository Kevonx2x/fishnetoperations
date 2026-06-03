import { Suspense } from "react";

import { DormspaceSubmitPageContent } from "@/components/dormspaces/dormspace-submit-page-content";

export const metadata = {
  title: "List your dormspace | BahayGo",
  description: "Submit your bedspace or coliving listing for review on BahayGo Dormspaces.",
};

export default function DormspaceSubmitPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center bg-[#FAF8F4]">
          <p className="text-sm font-medium text-[#484848]">Loading…</p>
        </div>
      }
    >
      <DormspaceSubmitPageContent />
    </Suspense>
  );
}

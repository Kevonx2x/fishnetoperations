import { Suspense } from "react";

import { DormspaceWelcome } from "@/components/dormspaces/dormspace-welcome";

export const metadata = {
  title: "Find your dorm | BahayGo dormspacers",
  description:
    "Find your dorm. Free to list. Verified landlords only. Reach students and young professionals across Metro Manila.",
};

export default function DormspaceWelcomePage() {
  return (
    <Suspense fallback={null}>
      <DormspaceWelcome />
    </Suspense>
  );
}

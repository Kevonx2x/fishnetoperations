"use client";

import dynamic from "next/dynamic";

const HomePageContent = dynamic(
  () =>
    import("@/components/client/home-page-content").then((m) => ({
      default: m.HomePageContent,
    })),
  { ssr: false, loading: () => null },
);

export default function HomePage() {
  return <HomePageContent />;
}

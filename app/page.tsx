"use client";

import dynamic from "next/dynamic";
import { HomepageLoadShell } from "@/components/marketplace/homepage-load-shell";

const HomePageContent = dynamic(
  () =>
    import("@/components/client/home-page-content").then((m) => ({
      default: m.HomePageContent,
    })),
  { ssr: false, loading: () => <HomepageLoadShell /> },
);

export default function HomePage() {
  return <HomePageContent />;
}

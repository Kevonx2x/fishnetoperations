"use client";

import { SWRConfig } from "swr";

const swrDefaults = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  keepPreviousData: true,
} as const;

export function BahayGoSWRProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={swrDefaults}>{children}</SWRConfig>;
}

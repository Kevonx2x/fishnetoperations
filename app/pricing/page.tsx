import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PricingContent } from "./pricing-content";

export const metadata = {
  title: "Pricing — BahayGo",
  description: "Agent plans: Free, Pro, Featured, and Broker — listing limits, co-lists, and team seats.",
};

export default async function PricingPage() {
  const session = await getSessionProfile();
  let currentTier: string | null = null;
  if (session && (session.role === "agent" || session.role === "broker")) {
    const sb = await createSupabaseServerClient();
    const { data } = await sb.from("agents").select("listing_tier").eq("user_id", session.userId).maybeSingle();
    currentTier = (data?.listing_tier as string | undefined) ?? null;
  }

  return <PricingContent session={session} currentTier={currentTier} />;
}

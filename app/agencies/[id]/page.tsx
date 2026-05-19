"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AgencyContactModal } from "@/components/marketplace/agency-contact-modal";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { AgencyProfileListings } from "@/components/marketplace/agency-profile-listings";
import {
  AgencyProfileShell,
  type AgencyProfileShellAgency,
  type AgencyProfileShellAgent,
} from "@/components/marketplace/agency-profile-shell";
import { agencyCityLabel } from "@/lib/agency-demo-visuals";
import { publicListingExpiryOrFilter } from "@/lib/listing-expiry-public-filter";
import { hideTutorialDemoPropertiesOrFilter } from "@/lib/tutorial-demo-property-filter";
import type { DbProperty } from "@/lib/marketplace-property";
import { supabase } from "@/lib/supabase";

const PROPERTY_SELECT = `
  id, created_at, name, location, price, rent_price, sqft, beds, baths, image_url, status, listed_by, description, property_type,
  is_presale, developer_name, turnover_date, unit_types, deleted_at, availability_state, listing_type,
  property_photos (url, sort_order),
  property_agents (agent:agents (id, user_id, name, email, phone, image_url, score, closings, response_time, availability, updated_at, agencies (id, company_name, logo_url), profiles(email, phone)))
`;

export default function AgencyProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [agency, setAgency] = useState<AgencyProfileShellAgency | null>(null);
  const [agents, setAgents] = useState<AgencyProfileShellAgent[]>([]);
  const [properties, setProperties] = useState<DbProperty[]>([]);
  const [totalListings, setTotalListings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);

    const { data: ag, error } = await supabase
      .from("agencies")
      .select("id, company_name, bio, logo_url, created_at, verified, user_id")
      .eq("id", id)
      .eq("status", "approved")
      .eq("verified", true)
      .maybeSingle();

    if (error || !ag) {
      setAgency(null);
      setAgents([]);
      setProperties([]);
      setTotalListings(0);
      setNotFound(true);
      setLoading(false);
      return;
    }

    const agencyRow = ag as AgencyProfileShellAgency & { user_id: string };
    setAgency(agencyRow);

    const { data: agentRows } = await supabase
      .from("agents")
      .select("id, name, image_url, verified, user_id, score")
      .eq("agency_id", id)
      .eq("status", "approved")
      .order("name", { ascending: true })
      .limit(8);

    const agentList = (agentRows ?? []) as (AgencyProfileShellAgent & { user_id: string })[];
    const areaLabel = agencyCityLabel(id);

    const agentUserIds = agentList.map((a) => a.user_id).filter(Boolean);
    const listingCountByUser = new Map<string, number>();
    if (agentUserIds.length > 0) {
      const { data: listingOwners } = await supabase
        .from("properties")
        .select("listed_by")
        .in("listed_by", agentUserIds)
        .or(publicListingExpiryOrFilter())
        .or(hideTutorialDemoPropertiesOrFilter())
        .is("deleted_at", null)
        .eq("availability_state", "available");

      for (const row of listingOwners ?? []) {
        const uid = (row as { listed_by?: string }).listed_by;
        if (!uid) continue;
        listingCountByUser.set(uid, (listingCountByUser.get(uid) ?? 0) + 1);
      }
    }

    setAgents(
      agentList.map((a) => ({
        ...a,
        areaLabel,
        listingCount: a.user_id ? listingCountByUser.get(a.user_id) ?? 0 : 0,
      })),
    );

    const ownerIds = [
      ...new Set([agencyRow.user_id, ...agentList.map((a) => a.user_id).filter(Boolean)]),
    ].filter(Boolean);

    if (ownerIds.length) {
      const { data: props, count } = await supabase
        .from("properties")
        .select(PROPERTY_SELECT, { count: "exact" })
        .in("listed_by", ownerIds)
        .or(publicListingExpiryOrFilter())
        .or(hideTutorialDemoPropertiesOrFilter())
        .is("deleted_at", null)
        .eq("availability_state", "available")
        .order("created_at", { ascending: false })
        .limit(12);

      setProperties((props ?? []) as unknown as DbProperty[]);
      setTotalListings(count ?? props?.length ?? 0);
    } else {
      setProperties([]);
      setTotalListings(0);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <MaddenTopNav />
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="h-56 animate-pulse rounded-3xl bg-black/5" />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/5" />
            ))}
          </div>
          <div className="mt-10 flex gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[412px] w-[240px] animate-pulse rounded-2xl bg-black/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !agency) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <MaddenTopNav />
        <main className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">Agency not found</h1>
          <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/55">
            This profile may be pending review or no longer available.
          </p>
          <Link href="/agencies" className="mt-6 inline-block font-semibold text-[#6B9E6E] underline">
            Back to agencies
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4]">
      <MaddenTopNav />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-16">
        <p className="mb-6 text-sm font-semibold text-[#2C2C2C]/65">
          <Link href="/" className="hover:text-[#2C2C2C]">
            Home
          </Link>{" "}
          ·{" "}
          <Link href="/agencies" className="hover:text-[#2C2C2C]">
            Agencies
          </Link>{" "}
          · <span className="text-[#2C2C2C]">{agency.company_name}</span>
        </p>
        <AgencyProfileShell
          agency={agency}
          agents={agents}
          stats={{ agentCount: agents.length }}
          onContactAgency={() => setContactOpen(true)}
          listingsSlot={
            <AgencyProfileListings
              properties={properties}
              loading={false}
              totalCount={totalListings}
            />
          }
        />
        <AgencyContactModal
          open={contactOpen}
          onOpenChange={setContactOpen}
          agencyId={agency.id}
          agencyName={agency.company_name}
          onSent={() => toast.success("Inquiry sent")}
        />
      </main>
    </div>
  );
}

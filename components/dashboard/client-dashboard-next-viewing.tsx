import Image from "next/image";
import Link from "next/link";
import { Calendar } from "lucide-react";

import { ClientAvatar } from "@/components/client/client-avatar";
import { manilaLongDateLabelFromInstant } from "@/lib/manila-long-date";
import { manilaTimeLabel12hFromInstant } from "@/lib/manila-datetime";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function pickPropertyImageUrl(
  imageUrl: string | null | undefined,
  photos: { url: string | null; sort_order: number | null }[] | null | undefined,
): string | null {
  const list = [...(photos ?? [])].sort(
    (a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0),
  );
  const first = list.find((ph) => ph.url?.trim());
  if (first?.url?.trim()) return first.url.trim();
  const u = imageUrl?.trim();
  return u || null;
}

function locationSubtitle(city: string | null | undefined, location: string | null | undefined): string {
  const c = city?.trim();
  const loc = location?.trim() || "";
  if (!loc) return c || "—";
  if (c && loc.toLowerCase().startsWith(c.toLowerCase())) return loc;
  if (c) return `${c}, ${loc}`;
  return loc;
}

export default async function ClientDashboardNextViewing(props: { userId: string }) {
  const supabase = await createSupabaseServerClient();

  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, agent_id, property_id")
    .eq("client_id", props.userId);

  if (leadsErr || !leads?.length) {
    return <NextViewingEmpty />;
  }

  const leadIds = (leads as { id: unknown }[])
    .map((l) => (typeof l.id === "number" ? l.id : Number(l.id)))
    .filter((id) => Number.isFinite(id)) as number[];

  if (!leadIds.length) return <NextViewingEmpty />;

  const { data: viewings, error: vErr } = await supabase
    .from("viewings")
    .select("scheduled_at, lead_id")
    .in("lead_id", leadIds)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1);

  if (vErr || !viewings?.length) {
    return <NextViewingEmpty />;
  }

  const v = viewings[0] as { scheduled_at: string; lead_id: number };
  const leadRow = (leads as { id: number; agent_id: string | null; property_id: string | null }[]).find(
    (l) => Number(l.id) === Number(v.lead_id),
  );
  if (!leadRow?.property_id || !leadRow.agent_id) {
    return <NextViewingEmpty />;
  }

  const [{ data: property, error: pErr }, { data: agent, error: aErr }, { data: photos }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, location, city, image_url, deleted_at, availability_state")
      .eq("id", leadRow.property_id)
      .maybeSingle(),
    supabase.from("profiles").select("full_name, avatar_url").eq("id", leadRow.agent_id).maybeSingle(),
    supabase.from("property_photos").select("url, sort_order").eq("property_id", leadRow.property_id),
  ]);

  if (pErr || !property || aErr || !agent) {
    return <NextViewingEmpty />;
  }

  const p = property as {
    id: string;
    name: string | null;
    location: string | null;
    city: string | null;
    image_url: string | null;
    deleted_at: string | null;
    availability_state: string | null;
  };

  if (p.deleted_at || (p.availability_state && p.availability_state !== "available")) {
    return <NextViewingEmpty />;
  }

  const img = pickPropertyImageUrl(p.image_url, photos as { url: string | null; sort_order: number | null }[] | null);
  const when = new Date(v.scheduled_at);
  const pill = `${manilaLongDateLabelFromInstant(when)} • ${manilaTimeLabel12hFromInstant(when)}`;
  const agentName = (agent as { full_name: string | null }).full_name?.trim() || "Agent";
  const agentAvatar = (agent as { avatar_url: string | null }).avatar_url?.trim() || null;

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-[#2C2C2C]/[0.045] md:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold tracking-tight text-[#2C2C2C] md:text-xl">Your next viewing</h2>
        <Link href="/dashboard/client/pipeline" className="shrink-0 text-sm font-semibold text-[#6B9E6E] hover:underline">
          View all
        </Link>
      </div>

      <div className="mt-3">
        <div className="relative h-28 w-full overflow-hidden rounded-lg bg-[#2C2C2C]/[0.06] sm:h-32 lg:h-28">
          {img ? (
            <Image src={img} alt="" fill className="object-cover" sizes="(min-width: 1024px) 360px, 100vw" />
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
          <div className="min-w-0">
            <p className="text-base font-semibold leading-snug text-[#2C2C2C]">{p.name?.trim() || "Property"}</p>
            <p className="mt-1 text-sm text-gray-600">{locationSubtitle(p.city, p.location)}</p>
          </div>
          <div className="flex items-start gap-2 sm:justify-end">
            <ClientAvatar name={agentName} avatarUrl={agentAvatar} sizePx={32} textClassName="text-xs" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug text-[#2C2C2C]">{agentName}</p>
              <p className="text-[11px] font-medium text-[#2C2C2C]/50">BahayGo Partner</p>
            </div>
          </div>
        </div>

        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#6B9E6E]/10 px-2.5 py-1.5 text-xs font-semibold text-[#2d5a30] sm:text-sm">
          <Calendar className="size-3.5 shrink-0 text-[#6B9E6E] sm:size-4" aria-hidden />
          <span>{pill}</span>
        </div>

        <div className="mt-3">
          <Link href={`/properties/${p.id}`} className="text-sm font-semibold text-[#6B9E6E] hover:underline">
            View details →
          </Link>
        </div>
      </div>
    </section>
  );
}

function NextViewingEmpty() {
  return (
    <section className="flex flex-col items-center rounded-2xl bg-white p-5 text-center ring-1 ring-[#2C2C2C]/[0.045] md:p-6">
      <h2 className="font-serif text-xl font-semibold tracking-tight text-[#2C2C2C]">No upcoming viewings</h2>
      <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-[#2C2C2C]/55">
        Browse the marketplace to find your next home
      </p>
      <Link
        href="/"
        className="mt-4 inline-flex h-9 items-center justify-center rounded-xl border-2 border-[#6B9E6E]/60 bg-transparent px-5 text-sm font-semibold text-[#6B9E6E] transition hover:border-[#6B9E6E] hover:bg-[#6B9E6E]/8"
      >
        Browse Listings
      </Link>
    </section>
  );
}

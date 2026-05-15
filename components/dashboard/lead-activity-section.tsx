"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Check,
  FileText,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildLeadActivityEvents,
  fetchLeadActivityBundle,
  formatActivityTimelineRelative,
  type LeadActivityEvent,
  type LeadActivityEventKind,
  type LeadActivityLeadContext,
} from "@/lib/lead-activity-timeline";

const ICON_BY_KIND: Record<LeadActivityEventKind, LucideIcon> = {
  lead_received: UserPlus,
  viewing_requested: Calendar,
  viewing_scheduled: Calendar,
  viewing_rescheduled: Calendar,
  viewing_cancelled: X,
  viewing_completed: Check,
  document_requested: FileText,
  document_uploaded: FileText,
  offer_made: ArrowRight,
  reservation_created: ArrowRight,
  deal_closed: ArrowRight,
};

function ActivityRow({ event }: { event: LeadActivityEvent }) {
  const Icon = ICON_BY_KIND[event.kind];
  return (
    <li className="flex min-h-10 items-start gap-2.5 border-b border-stone-100 py-2 last:border-b-0">
      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[#2C2C2C]/55">
        <Icon className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-[#2C2C2C]">{event.label}</p>
        {event.sublabel ? (
          <p className="mt-0.5 text-xs leading-snug text-gray-500">{event.sublabel}</p>
        ) : null}
      </div>
      <span className="shrink-0 pt-0.5 text-xs text-gray-400">{formatActivityTimelineRelative(event.timestamp)}</span>
    </li>
  );
}

export function LeadActivitySection({ lead }: { lead: LeadActivityLeadContext }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [resolvedEvents, setResolvedEvents] = useState<LeadActivityEvent[]>([]);

  const leadContext = useMemo(
    (): LeadActivityLeadContext => ({
      id: lead.id,
      created_at: lead.created_at,
      viewing_request_id: lead.viewing_request_id,
      property_id: lead.property_id,
      client_id: lead.client_id,
      closed_date: lead.closed_date,
      closed_at: lead.closed_at,
    }),
    [
      lead.id,
      lead.created_at,
      lead.viewing_request_id,
      lead.property_id,
      lead.client_id,
      lead.closed_date,
      lead.closed_at,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const bundle = await fetchLeadActivityBundle(supabase, leadContext);
        if (cancelled) return;
        setResolvedEvents(buildLeadActivityEvents(leadContext, bundle));
      } catch (err) {
        console.warn("[lead-activity] load failed", err);
        if (!cancelled) {
          setResolvedEvents(
            buildLeadActivityEvents(leadContext, {
              viewings: [],
              viewingRequests: [],
              dealDocuments: [],
              offers: [],
              reservations: [],
            }),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, leadContext]);

  const displayEvents = loading
    ? []
    : resolvedEvents.length > 0
      ? resolvedEvents
      : buildLeadActivityEvents(leadContext, {
          viewings: [],
          viewingRequests: [],
          dealDocuments: [],
          offers: [],
          reservations: [],
        });

  if (!loading && displayEvents.length === 0) return null;

  return (
    <div className="border-b border-[#2C2C2C]/10 px-6 pb-4 pt-2">
      <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">Activity</p>
      <div className="mt-3 max-h-[280px] overflow-y-auto overscroll-y-contain pr-1">
        {loading ? (
          <p className="text-sm text-[#2C2C2C]/45">Loading activity…</p>
        ) : (
          <ul>
            {displayEvents.map((event, i) => (
              <ActivityRow key={`${event.kind}-${event.timestamp}-${i}`} event={event} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

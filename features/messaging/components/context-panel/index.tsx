import { useChatContext } from "stream-chat-react";

import { PropertyCard } from "@/features/messaging/components/context-panel/property-card";
import { usePropertySummary } from "@/features/messaging/hooks/use-property-summary";
import type { ChannelPropertyMetadata } from "@/features/messaging/types";
import { cn } from "@/lib/utils";

const EMPTY_STATE = "No property linked to this conversation";

/**
 * Right sidebar panel for the active conversation.
 * Must read the active channel directly from Stream's `useChatContext()` (never via props)
 * to avoid stale channel propagation.
 */
export function ContextPanel(props: { className?: string }) {
  const { channel } = useChatContext();
  const channelData = channel?.data as ChannelPropertyMetadata | undefined;
  const propertyId = (channelData?.property_id ?? "").trim() || null;

  const { summary, loading } = usePropertySummary(propertyId);

  if (!channel || !propertyId) {
    return (
      <div className={cn("px-4 py-4", props.className)}>
        <p className="text-sm font-semibold text-fg/45">{EMPTY_STATE}</p>
      </div>
    );
  }

  return (
    <PropertyCard
      propertyId={propertyId}
      channelMeta={channelData ?? {}}
      summary={summary}
      loading={loading}
      className={props.className}
    />
  );
}


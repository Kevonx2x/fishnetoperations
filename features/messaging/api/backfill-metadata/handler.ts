import { backfillStreamChannelPropertyMetadata } from "@/lib/services/stream-channel-backfill";

export async function backfillChannelMetadata() {
  return backfillStreamChannelPropertyMetadata();
}


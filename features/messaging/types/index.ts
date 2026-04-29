import type { Channel as StreamChannel, ChannelMemberResponse, UserResponse } from "stream-chat";

export type { CreateMessagingChannelErrorBody, CreateMessagingChannelResponse } from "./channel-api";

export type ConversationFilterMode = "all" | "unread" | "pinned" | "archived";

export type ChannelPropertyMetadata = {
  property_id?: string | null;
  property_name?: string | null;
  property_price?: string | null;
  property_image?: string | null;
};

export type PeerInfo = {
  id: string;
  name: string;
  image?: string;
  online: boolean;
  lastActive?: string | null;
};

export type StreamMember = ChannelMemberResponse & { user?: UserResponse };

export type MessagingChannel = StreamChannel & {
  data?: (StreamChannel["data"] & ChannelPropertyMetadata) | undefined;
  state?: StreamChannel["state"] & {
    members?: Record<string, StreamMember>;
  };
};


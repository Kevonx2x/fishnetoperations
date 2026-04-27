/**
 * Successful JSON body from `POST /api/stream/channel`.
 * The `channel_id` is the custom Stream channel id (type `messaging` is implied in the app).
 */
export type CreateMessagingChannelResponse = {
  channel_id: string;
};

/** Error JSON body from `POST /api/stream/channel`. */
export type CreateMessagingChannelErrorBody = {
  error: string;
};

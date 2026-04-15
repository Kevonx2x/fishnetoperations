import { StreamChat } from "stream-chat";

let serverClient: StreamChat | null = null;

/**
 * Server-side Stream Chat client (API secret). Uses public API key from `NEXT_PUBLIC_STREAM_API`.
 */
export function getStreamClient(): StreamChat {
  console.log(
    "[getStreamClient]",
    (process.env.NEXT_PUBLIC_STREAM_API ?? "").slice(0, 4),
    (process.env.STREAM_API_SECRET ?? "").slice(0, 4),
  );
  if (serverClient) return serverClient;
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API?.trim();
  const secret = process.env.STREAM_API_SECRET?.trim();
  if (!apiKey || !secret) {
    throw new Error("Missing NEXT_PUBLIC_STREAM_API or STREAM_API_SECRET");
  }
  serverClient = StreamChat.getInstance(apiKey, secret);
  return serverClient;
}

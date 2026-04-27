import { StreamChat } from "stream-chat";

export function getStreamApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API?.trim();
  if (!apiKey) throw new Error("Missing NEXT_PUBLIC_STREAM_API");
  return apiKey;
}

export function createBrowserStreamClient(): StreamChat {
  return StreamChat.getInstance(getStreamApiKey());
}

export function createServerStreamClient(): StreamChat {
  const apiKey = getStreamApiKey();
  const secret = process.env.STREAM_API_SECRET?.trim();
  if (!secret) throw new Error("Missing STREAM_API_SECRET");
  return StreamChat.getInstance(apiKey, secret);
}


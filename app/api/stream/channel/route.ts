import { postStreamChannel } from "@/features/messaging/api/channel/handler";

export async function POST(req: Request) {
  return postStreamChannel(req);
}

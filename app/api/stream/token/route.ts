import { postStreamToken } from "@/features/messaging/api/token/handler";

export async function POST(req: Request) {
  return postStreamToken(req);
}

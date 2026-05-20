import { z } from "zod";

import { fail, fromZodError } from "@/lib/api/response";
import { handleDormspaceInquiry } from "@/lib/dormspace-inquiry-handler";

const bodySchema = z.object({
  name: z.string().min(1).max(500),
  email: z.string().email().max(320),
  phone: z.string().max(200).optional().nullable(),
  message: z.string().min(1).max(10000),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { id: dormspace_id } = await context.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fromZodError(parsed.error);

  return handleDormspaceInquiry(dormspace_id, parsed.data);
}

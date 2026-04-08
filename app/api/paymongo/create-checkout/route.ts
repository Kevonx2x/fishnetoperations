import { z } from "zod";
import { fail, fromZodError } from "@/lib/api/response";
import { getSessionProfile } from "@/lib/admin-api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  billingCancelRedirectUrl,
  billingSuccessRedirectUrl,
  isPaymongoSubscriptionTier,
  paymongoBasicAuthHeader,
  subscriptionDescription,
  subscriptionRemarks,
  tierAmountCentavos,
  type PaymongoSubscriptionTier,
} from "@/lib/paymongo";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tier: z.enum(["pro", "featured", "broker"]),
});

function extractCheckoutUrl(json: unknown): string | null {
  const d = json as {
    data?: { attributes?: { checkout_url?: string } };
  };
  const url = d?.data?.attributes?.checkout_url;
  return typeof url === "string" && url.startsWith("http") ? url : null;
}

export async function POST(req: Request) {
  const session = await getSessionProfile();
  if (!session) {
    return fail("UNAUTHORIZED", "Sign in to continue", 401);
  }
  if (session.role !== "agent" && session.role !== "broker") {
    return fail("FORBIDDEN", "Only agents can subscribe", 403);
  }

  let jsonBody: unknown;
  try {
    jsonBody = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }
  const parsed = bodySchema.safeParse(jsonBody);
  if (!parsed.success) return fromZodError(parsed.error);

  const tier = parsed.data.tier as PaymongoSubscriptionTier;
  if (!isPaymongoSubscriptionTier(tier)) {
    return fail("VALIDATION_ERROR", "Invalid tier", 422);
  }

  const supabase = await createSupabaseServerClient();
  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", session.userId)
    .maybeSingle();

  if (agentErr) {
    return fail("DATABASE_ERROR", agentErr.message, 500);
  }
  if (!agent?.id) {
    return fail("NOT_FOUND", "No agent profile for this account", 404);
  }

  if (!process.env.PAYMONGO_SECRET_KEY) {
    return fail("CONFIG_ERROR", "PayMongo is not configured", 503);
  }

  const amount = tierAmountCentavos(tier);
  const description = subscriptionDescription(tier);
  const remarks = subscriptionRemarks(agent.id, tier);
  const successUrl = billingSuccessRedirectUrl(tier);
  const cancelUrl = billingCancelRedirectUrl();

  const payload = {
    data: {
      attributes: {
        amount,
        currency: "PHP",
        description,
        remarks,
        checkout: {
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
      },
    },
  };

  let res = await fetch("https://api.paymongo.com/v1/links", {
    method: "POST",
    headers: {
      Authorization: paymongoBasicAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const fallbackPayload = {
      data: {
        attributes: {
          amount,
          currency: "PHP",
          description,
          remarks,
        },
      },
    };
    res = await fetch("https://api.paymongo.com/v1/links", {
      method: "POST",
      headers: {
        Authorization: paymongoBasicAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fallbackPayload),
    });
    data = await res.json().catch(() => null);
  }

  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "errors" in data
        ? JSON.stringify((data as { errors: unknown }).errors)
        : res.statusText;
    console.error("[paymongo/create-checkout] PayMongo error:", msg);
    return fail("PAYMONGO_ERROR", "Could not create payment link", 502, data);
  }

  const checkoutUrl = extractCheckoutUrl(data);
  if (!checkoutUrl) {
    console.error("[paymongo/create-checkout] Missing checkout_url", data);
    return fail("PAYMONGO_ERROR", "Invalid PayMongo response", 502);
  }

  return Response.json({ checkoutUrl });
}

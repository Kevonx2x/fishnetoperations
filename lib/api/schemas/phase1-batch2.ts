import { z } from "zod";

export const registerBrokerSchema = z.object({
  name: z.string().min(1).max(200),
  company_name: z.string().min(1).max(200),
  license_number: z.string().min(1).max(100),
  license_expiry: z.string().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email(),
  website: z.string().max(500).optional().nullable(),
  logo_url: z.string().max(2000).optional().nullable(),
  bio: z.string().max(5000).optional().nullable(),
});

export const registerAgentSchema = z.object({
  name: z.string().min(1).max(200),
  license_number: z.string().min(1).max(100),
  license_expiry: z.string().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email(),
  bio: z.string().max(5000).optional().nullable(),
  broker_id: z.string().uuid().optional().nullable(),
});

export const verificationDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve") }),
  z.object({
    decision: z.literal("reject"),
    reason: z.string().min(1).max(2000),
  }),
]);

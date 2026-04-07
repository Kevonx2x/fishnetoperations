import { z } from "zod";

const PRC_LICENSE = /^PRC-AG-\d{4}-\d{5}$/;

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
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(200)
    .regex(/^[a-zA-Z\s'-]+$/, "Name must contain letters only"),
  license_number: z
    .string()
    .regex(PRC_LICENSE, "License must be PRC-AG-YYYY-XXXXX"),
  license_expiry: z
    .string()
    .min(1, "License expiry is required")
    .refine((s) => {
      const d = new Date(s + "T12:00:00");
      if (Number.isNaN(d.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d > today;
    }, "License expiry must be a future date"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .refine((s) => {
      let d = s.replace(/\D/g, "");
      if (d.startsWith("63")) d = d.slice(2);
      if (d.startsWith("0")) d = d.slice(1);
      return d.length === 10 && d.startsWith("9");
    }, "Phone must be +63 9XX XXX XXXX (10 digits)"),
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

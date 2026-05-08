import { z } from "zod";
import {
  compactPhoneForE164,
  E164_COMPACT_REGEX,
  E164_INVALID_MESSAGE,
} from "@/lib/validation/e164-phone";

const PRC_LICENSE = /^PRC-AG-\d{4}-\d{5}$/;

function phNationalFromCompact(compact: string): string | null {
  if (!compact.startsWith("+63")) return null;
  let d = compact.slice(1).replace(/\D/g, "");
  if (d.startsWith("63")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.length ? d.slice(0, 10) : null;
}

export const registerBrokerSchema = z.object({
  name: z.string().min(1).max(200),
  company_name: z.string().min(1).max(200),
  license_number: z.string().min(1).max(100),
  license_expiry: z.string().optional().nullable(),
  phone: z.preprocess((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v !== "string" || v.trim() === "") return null;
    return compactPhoneForE164(v);
  }, z.union([z.null(), z.string().regex(E164_COMPACT_REGEX, E164_INVALID_MESSAGE)])),
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
    .transform((s) => compactPhoneForE164(s))
    .superRefine((compact, ctx) => {
      if (!E164_COMPACT_REGEX.test(compact)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: E164_INVALID_MESSAGE });
        return;
      }
      const national = phNationalFromCompact(compact);
      if (national !== null) {
        if (national.length !== 10 || !national.startsWith("9")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Philippine (+63) mobile numbers must be 9XXXXXXXXX (10 digits starting with 9 after +63).",
          });
        }
      }
    }),
  email: z.string().email(),
  bio: z.string().max(5000).optional().nullable(),
  brokers: z
    .array(
      z
        .object({
          broker_id: z.string().uuid(),
          is_primary: z.boolean().optional().default(false),
        })
        .strict(),
    )
    .max(10)
    .optional()
    .nullable(),
  broker_id: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return null;
      if (typeof v === "string" && v.trim() === "") return null;
      return typeof v === "string" ? v.trim() : v;
    },
    z.union([
      z.null(),
      z.string().uuid(
        "broker_id must be the UUID of an approved brokerage from the list (not the company name). Omit or use null for an independent agent.",
      ),
    ]),
  ),
  prc_document_url: z.string().optional(),
  selfie_url: z.string().optional(),
});

export const verificationDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve") }),
  z.object({
    decision: z.literal("reject"),
    reason: z.string().min(1).max(2000),
  }),
]);

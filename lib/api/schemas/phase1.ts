import { z } from "zod";

export const leadStageSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "viewing",
  "negotiation",
  "closed_won",
  "closed_lost",
]);

export const createLeadSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(50).optional().nullable(),
  property_interest: z.string().max(500).optional().nullable(),
  message: z.string().max(5000).optional().nullable(),
  source: z.string().max(100).optional().default("website"),
  stage: leadStageSchema.optional().default("new"),
  agent_id: z.string().uuid().optional().nullable(),
  broker_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
});

export const patchLeadSchema = z.object({
  stage: leadStageSchema.optional(),
  agent_id: z.string().uuid().nullable().optional(),
  broker_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).nullable().optional(),
  property_interest: z.string().max(500).nullable().optional(),
  message: z.string().max(5000).nullable().optional(),
});

export const savedSearchFiltersSchema = z.object({
  min_price: z.number().nonnegative().optional(),
  max_price: z.number().nonnegative().optional(),
  min_beds: z.number().int().min(0).optional(),
  min_baths: z.number().int().min(0).optional(),
  location_contains: z.string().max(200).optional(),
});

export const createSavedSearchSchema = z.object({
  name: z.string().min(1).max(200),
  filters: savedSearchFiltersSchema,
  alert_enabled: z.boolean().optional().default(true),
});

export const patchSavedSearchSchema = createSavedSearchSchema.partial();

export const matchRunSchema = z.object({
  saved_search_id: z.string().uuid().optional(),
});

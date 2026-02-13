import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// We don't need a DB for this MVP, but we'll define the schemas here for shared types

export const tripRequestSchema = z.object({
  energy: z.number().min(1).max(5),
  budget: z.number().min(1).max(5),
  activity: z.number().min(1).max(5),
  social: z.number().min(1).max(5),
  aesthetic: z.number().min(1).max(5),
  themes: z.array(z.string()).min(1),
  food: z.string(),
  weather: z.string(),
  days: z.coerce.number().min(1),
  location: z.string(),
  companions: z.string(),
});

export const dailyPlanSchema = z.object({
  day: z.number(),
  energy_level: z.enum(["low", "medium", "high"]),
  plan: z.object({
    morning: z.string(),
    afternoon: z.string(),
    evening: z.string(),
  }),
});

export const packingListSchema = z.object({
  clothes: z.object({
    tops: z.number(),
    bottoms: z.number(),
    outerwear: z.number(),
  }),
  shoes: z.array(z.string()),
  accessories: z.array(z.string()),
  misc: z.array(z.string()),
});

export const tripResponseSchema = z.object({
  trip_theme: z.string(),
  destination: z.string(),
  why_it_matches_you: z.array(z.string()),
  daily_itinerary: z.array(dailyPlanSchema),
  packing_list: packingListSchema,
  documents: z.array(z.string()),
});

export type TripRequest = z.infer<typeof tripRequestSchema>;
export type TripResponse = z.infer<typeof tripResponseSchema>;

import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// We don't need a DB for this MVP, but we'll define the schemas here for shared types

export const tripRequestSchema = z.object({
  trip_type: z.enum(["domestic", "international"], {
    required_error: "Please select domestic or international travel",
  }),
  energy: z.number().min(1).max(5),
  budget_level: z.number().min(1).max(5),
  budget_amount: z.number().positive("Budget amount is required"),
  currency: z.string().min(1, "Currency is required"),
  activity: z.number().min(1).max(5),
  social: z.number().min(1).max(5),
  aesthetic: z.number().min(1).max(5),
  themes: z.array(z.string()).min(1),
  food: z.string(),
  weather: z.string(),
  days: z.coerce.number().min(1),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  location: z.string().trim().min(1, "Starting location is required"),
  companions: z.string().min(1, "Companions is required"),
  personality: z.object({
    spontaneity: z.number().min(1).max(5),
    organization: z.number().min(1).max(5),
    curiosity: z.number().min(1).max(5),
  }),
}).refine(
  ({ startDate, endDate }) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return !isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"],
  },
);

export const dailyPlanSchema = z.object({
  day: z.number(),
  energy_level: z.enum(["low", "medium", "high"]),
  plan: z.object({
    morning: z.string(), // Will contain timing info in the string
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

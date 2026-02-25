import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// We don't need a DB for this MVP, but we'll define the schemas here for shared types

export const tripRequestSchema = z.object({
  trip_goal: z.enum(["need_recommendation", "know_destination"], {
    required_error: "Please select how you want to plan your trip",
  }),
  comfort_level: z.enum(["budget", "medium", "premium"], {
    required_error: "Please select comfort level",
  }),
  trip_type: z.enum(["domestic", "international"], {
    required_error: "Please select domestic or international travel",
  }),
  energy: z.number().min(1).max(5),
  number_of_people: z.number().int().min(1, "Number of people is required"),
  budget_mode: z.enum(["total", "per_person"], {
    required_error: "Please select budget mode",
  }),
  includes_flights: z.boolean(),
  max_flight_hours: z.number().min(1, "Max flight duration is required").max(24),
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
  destination_location: z.string().trim().optional(),
  must_avoid: z.string().trim().optional(),
  companions: z.string().min(1, "Companions is required"),
  personality: z.object({
    spontaneity: z.number().min(1).max(5),
    organization: z.number().min(1).max(5),
    curiosity: z.number().min(1).max(5),
  }),
}).superRefine((data, ctx) => {
  const { startDate, endDate } = data;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "End date must be after start date",
      path: ["endDate"],
    });
  }

  if (
    data.trip_goal === "know_destination" &&
    (!data.destination_location || data.destination_location.trim().length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Destination location is required",
      path: ["destination_location"],
    });
  }
});

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

export const destinationOptionSchema = z.object({
  destination: z.string(),
  country: z.string(),
  summary: z.string(),
  estimated_budget: z.object({
    low: z.number(),
    high: z.number(),
    currency: z.string(),
  }),
  metrics: z.object({
    vibe_fit: z.number().min(1).max(10),
    affordability: z.number().min(1).max(10),
    travel_convenience: z.number().min(1).max(10),
    safety_accessibility: z.number().min(1).max(10),
    total_score: z.number().min(1).max(10),
  }),
});

export const destinationRecommendationResponseSchema = z.object({
  options: z.array(destinationOptionSchema).min(3).max(3),
});

export type TripRequest = z.infer<typeof tripRequestSchema>;
export type TripResponse = z.infer<typeof tripResponseSchema>;
export type DestinationRecommendationResponse = z.infer<
  typeof destinationRecommendationResponseSchema
>;

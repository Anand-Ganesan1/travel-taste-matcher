import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

// Initialize OpenAI with Replit AI Integration env vars
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post(api.trips.generate.path, async (req, res) => {
    try {
      const input = api.trips.generate.input.parse(req.body);

      const prompt = `
You are a travel planner AI that designs trips based on personality and vibe.

User preferences:
Energy level: ${input.energy}
Budget elasticity: ${input.budget_level}
Budget amount: ${input.budget_amount} ${input.currency}
Activity intensity: ${input.activity}
Social media importance: ${input.social}
Aesthetic preference: ${input.aesthetic}
Themes: ${input.themes.join(", ")}
Food preference: ${input.food}
Weather preference: ${input.weather}
Travel dates: ${input.startDate} to ${input.endDate} (${input.days} days)
Starting location: ${input.location}
Traveling with: ${input.companions}
Personality traits (1-5): Spontaneity: ${input.personality.spontaneity}, Organization: ${input.personality.organization}, Curiosity: ${input.personality.curiosity}

Generate a personalized travel plan.

Requirements:
Pick ONE destination that fits the weather preference for the given dates and budget.
Create a trip theme name.
Match daily energy levels.
Include a realistic packing list.
Add general document reminders (passport, ID, visas if international).
Each itinerary item MUST include a specific time (e.g., "09:00 AM", "02:30 PM").

Respond ONLY in valid JSON using the following schema:
{
  "trip_theme": "",
  "destination": "",
  "why_it_matches_you": [],
  "daily_itinerary": [
    {
      "day": 1,
      "energy_level": "low | medium | high",
      "plan": {
        "morning": "TIMED PLAN (e.g., 09:00 AM - Activity...)",
        "afternoon": "TIMED PLAN (e.g., 01:00 PM - Activity...)",
        "evening": "TIMED PLAN (e.g., 07:00 PM - Activity...)"
      }
    }
  ],
  "packing_list": {
    "clothes": {
      "tops": 0,
      "bottoms": 0,
      "outerwear": 0
    },
    "shoes": [],
    "accessories": [],
    "misc": []
  },
  "documents": []
}

Do NOT include explanations or markdown.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from AI");
      }

      const result = JSON.parse(content);
      res.json(result);
    } catch (err) {
      console.error("Error generating itinerary:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Failed to generate itinerary" });
    }
  });

  return httpServer;
}

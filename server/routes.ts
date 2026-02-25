import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

function cleanEnv(value?: string): string | undefined {
  if (!value) return undefined;
  return value
    .trim()
    .replace(/[\u00A0\u1680\u2000-\u200F\u2028\u2029\u202F\u205F\u3000]/g, "")
    .replace(/^['"]|['"]$/g, "");
}

const currencyStrengthGuidanceMap: Record<string, "weak" | "medium" | "strong"> = {
  USD: "strong",
  EUR: "strong",
  GBP: "strong",
  AUD: "medium",
  CAD: "medium",
  INR: "weak",
  JPY: "weak",
};

const COUNTRY_ALIASES: Record<string, string> = {
  "The Netherlands": "Netherlands",
  Holland: "Netherlands",
  "United States of America": "United States",
  USA: "United States",
  "U.S.A.": "United States",
  UK: "United Kingdom",
  "U.K.": "United Kingdom",
  UAE: "United Arab Emirates",
};

const nearbyValueDestinationsByCountry: Record<string, string[]> = {
  Netherlands: ["Belgium", "Germany", "Portugal", "Czech Republic"],
  India: ["Sri Lanka", "Thailand", "Vietnam", "Nepal"],
  Australia: ["Bali (Indonesia)", "Auckland (New Zealand)", "Fiji", "Vietnam"],
  "New Zealand": ["Australia (East Coast)", "Fiji", "Bali (Indonesia)", "Vietnam"],
  "United States": ["Mexico", "Costa Rica", "Dominican Republic", "Colombia"],
  Canada: ["Mexico", "Costa Rica", "Portugal", "Dominican Republic"],
  "United Kingdom": ["Portugal", "Spain", "Turkey", "Morocco"],
  Singapore: ["Malaysia", "Thailand", "Vietnam", "Indonesia"],
  Japan: ["South Korea", "Taiwan", "Thailand", "Vietnam"],
};

function normalizeCountryName(country?: string): string | undefined {
  if (!country) return undefined;
  const trimmed = country.trim();
  if (!trimmed) return undefined;
  return COUNTRY_ALIASES[trimmed] || trimmed;
}

function getCountryFromLocation(location: string): string | undefined {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  return normalizeCountryName(parts[parts.length - 1]);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/location-suggestions", async (req, res) => {
    try {
      const query = String(req.query.query || "").trim();
      if (query.length < 2) {
        return res.json({ suggestions: [] });
      }

      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`,
      );

      if (!response.ok) {
        return res.json({ suggestions: [] });
      }

      const data = (await response.json()) as {
        results?: Array<{
          name?: string;
          country?: string;
          country_code?: string;
        }>;
      };
      const countryDisplay = new Intl.DisplayNames(["en"], { type: "region" });

      const suggestions = (data.results || [])
        .filter((result) => result.name && result.country)
        .map((result) => {
          const city = result.name as string;
          const canonicalCountry = normalizeCountryName(
            result.country_code ? countryDisplay.of(result.country_code) || result.country : result.country,
          ) as string;
          const displayName = `${city}, ${canonicalCountry}`;
          const country = canonicalCountry;
          return { city, country, displayName };
        })
        .filter(
          (suggestion, index, arr) =>
            arr.findIndex((s) => s.displayName === suggestion.displayName) === index,
        );

      return res.json({ suggestions });
    } catch (error) {
      console.error("Location suggestion fetch failed:", error);
      return res.json({ suggestions: [] });
    }
  });

  app.post(api.trips.generate.path, async (req, res) => {
    try {
      const input = api.trips.generate.input.parse(req.body);
      const openAiApiKey = cleanEnv(
        process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      );
      const openAiBaseUrl = cleanEnv(
        process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL,
      );
      const model = cleanEnv(process.env.OPENAI_MODEL) || "gpt-4o-mini";

      if (!openAiApiKey) {
        return res.status(500).json({
          message:
            "OpenAI API key is missing. Set OPENAI_API_KEY (or AI_INTEGRATIONS_OPENAI_API_KEY) and restart the server.",
        });
      }

      const openai = new OpenAI({
        apiKey: openAiApiKey,
        baseURL: openAiBaseUrl,
      });
      const seniorCitizenGuidance =
        input.companions === "Senior Citizens"
          ? `
Additional constraints for senior travelers:
- Prioritize senior-friendly destinations with strong accessibility infrastructure.
- Prefer minimal walking distances, lower physical strain, and frequent rest breaks.
- Avoid late-night, high-risk, and physically intensive activities.
- Recommend accessible transportation and accommodation options.
- Include practical health/safety and mobility considerations in the itinerary.
`
          : "";
      const originCountry = getCountryFromLocation(input.location);
      const nearbyValueOptions = nearbyValueDestinationsByCountry[originCountry || ""] || [];
      const nearbyValueOptionsText = nearbyValueOptions.length
        ? nearbyValueOptions.join(", ")
        : "nearby value destinations in the same broad region";
      const tripTypeGuidance =
        input.trip_type === "domestic"
          ? `
Trip type requirement:
- User wants a domestic trip.
- Destination MUST be inside the same country as the starting location.
`
          : `
Trip type requirement:
- User wants an international trip.
- Destination MUST be outside the starting location country.
- Prefer geographically closer regions from the starting location before long-haul options, unless budget clearly supports long-haul.
- Since user is a citizen of the starting location country, include relevant visa/entry reminders.
`;
      const currencyStrength = currencyStrengthGuidanceMap[input.currency] || "medium";

      const prompt = `
You are a travel planner AI that designs trips based on personality and vibe.

User preferences:
Energy level: ${input.energy}
Budget elasticity: ${input.budget_level}
Budget amount: ${input.budget_amount} ${input.currency}
Budget currency strength: ${currencyStrength}
Activity intensity: ${input.activity}
Social media importance: ${input.social}
Aesthetic preference: ${input.aesthetic}
Themes: ${input.themes.join(", ")}
Food preference: ${input.food}
Weather preference: ${input.weather}
Travel dates: ${input.startDate} to ${input.endDate} (${input.days} days)
Starting location: ${input.location}
Trip type selected: ${input.trip_type}
Assume the traveler is a citizen of the country in the starting location.
Detected origin country: ${originCountry || "Unknown"}
Nearby value destinations from this origin: ${nearbyValueOptionsText}
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
Use the selected budget currency strength when deciding destination affordability.
If budget currency is weak, bias toward better-value destinations and cost-efficient routing.
If budget currency is strong, wider destination options are acceptable but still stay realistic.
Do not assume proximity to any specific country solely from the chosen currency; use starting location geography and trip type first.
${seniorCitizenGuidance}
${tripTypeGuidance}

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
        model,
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

      const apiError = err as {
        status?: number;
        code?: string;
        type?: string;
        message?: string;
        error?: {
          code?: string;
          type?: string;
          message?: string;
        };
      };
      const errorCode = apiError.code || apiError.error?.code;
      const errorType = apiError.type || apiError.error?.type;
      const errorMessage = apiError.message || apiError.error?.message;

      if (apiError.status === 401 || errorCode === "invalid_api_key") {
        return res.status(500).json({
          message:
            "Invalid OpenAI API key. Update OPENAI_API_KEY (or AI_INTEGRATIONS_OPENAI_API_KEY) and restart the server.",
        });
      }

      if (apiError.status === 404 || errorCode === "model_not_found") {
        return res.status(500).json({
          message:
            "Configured OpenAI model is unavailable. Set OPENAI_MODEL to an accessible model (e.g. gpt-4o-mini).",
        });
      }

      if (
        apiError.status === 429 ||
        errorCode === "insufficient_quota" ||
        errorType === "insufficient_quota"
      ) {
        return res.status(500).json({
          message:
            "OpenAI quota exceeded for this API key. Add billing/credits in your OpenAI account and retry.",
        });
      }

      if (apiError.status === 400 && errorMessage) {
        return res.status(500).json({
          message: `OpenAI request failed: ${errorMessage}`,
        });
      }

      if (errorMessage) {
        return res.status(500).json({
          message: `Generation failed: ${errorMessage}`,
        });
      }

      res.status(500).json({ message: "Failed to generate itinerary" });
    }
  });

  return httpServer;
}

import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { destinationRecommendationResponseSchema } from "@shared/schema";

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

function toBoundedScore(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 5;
  return Math.max(1, Math.min(10, Number(num.toFixed(1))));
}

function normalizeRecommendationPayload(
  payload: unknown,
  currency: string,
): { options: Array<Record<string, unknown>> } {
  const data = payload as { options?: Array<Record<string, unknown>> };
  const options = (data.options || [])
    .slice(0, 3)
    .map((option) => {
      const metrics = (option.metrics || {}) as Record<string, unknown>;
      const estimatedBudget = (option.estimated_budget || {}) as Record<string, unknown>;
      const vibeFit = toBoundedScore(metrics.vibe_fit);
      const affordability = toBoundedScore(metrics.affordability);
      const travelConvenience = toBoundedScore(metrics.travel_convenience);
      const safetyAccessibility = toBoundedScore(metrics.safety_accessibility);
      const totalScoreRaw = metrics.total_score;
      const totalScore =
        typeof totalScoreRaw === "number" && Number.isFinite(totalScoreRaw)
          ? toBoundedScore(totalScoreRaw)
          : toBoundedScore(
              (vibeFit + affordability + travelConvenience + safetyAccessibility) / 4,
            );

      return {
        destination: String(option.destination || ""),
        country: String(option.country || ""),
        summary: String(option.summary || ""),
        estimated_budget: {
          low: Math.max(0, Number(estimatedBudget.low || 0)),
          high: Math.max(
            Math.max(0, Number(estimatedBudget.low || 0)),
            Number(estimatedBudget.high || 0),
          ),
          currency: String(estimatedBudget.currency || currency),
        },
        metrics: {
          vibe_fit: vibeFit,
          affordability,
          travel_convenience: travelConvenience,
          safety_accessibility: safetyAccessibility,
          total_score: totalScore,
        },
      };
    })
    .sort((a, b) => {
      const scoreA = ((a.metrics as Record<string, unknown>).total_score as number) || 0;
      const scoreB = ((b.metrics as Record<string, unknown>).total_score as number) || 0;
      return scoreB - scoreA;
    });

  return { options };
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
      const destinationCountry = input.destination_location
        ? getCountryFromLocation(input.destination_location)
        : undefined;
      const inferredTripType =
        input.trip_goal === "know_destination" && originCountry && destinationCountry
          ? originCountry.toLowerCase() === destinationCountry.toLowerCase()
            ? "domestic"
            : "international"
          : input.trip_type;
      const nearbyValueOptions = nearbyValueDestinationsByCountry[originCountry || ""] || [];
      const nearbyValueOptionsText = nearbyValueOptions.length
        ? nearbyValueOptions.join(", ")
        : "nearby value destinations in the same broad region";
      const tripTypeGuidance =
        inferredTripType === "domestic"
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
      const hasExplicitDestination =
        !!input.destination_location && input.destination_location.trim().length > 0;
      const currencyStrength = currencyStrengthGuidanceMap[input.currency] || "medium";
      const destinationPlanningGuidance =
        hasExplicitDestination
          ? `
Destination planning mode:
- User already selected destination: ${input.destination_location}
- Do NOT change destination. Build the itinerary specifically for this destination.
- Optimize travel plan, activities, and pacing for this exact destination based on user vibe/persona.
`
          : `
Destination recommendation mode:
- User wants destination suggestions.
- Recommend ONE destination that best fits budget, trip type, and preferences.
`;

      const prompt = `
You are a travel planner AI that designs trips based on personality and vibe.

User preferences:
Energy level: ${input.energy}
Comfort level: ${input.comfort_level}
Number of people: ${input.number_of_people}
Budget amount: ${input.budget_amount} ${input.currency}
Budget mode: ${input.budget_mode}
Includes flights in budget: ${input.includes_flights ? "yes" : "no"}
Max flight duration: ${input.max_flight_hours} hours
Budget currency strength: ${currencyStrength}
Activity intensity: ${input.activity}
Social media importance: ${input.social}
Aesthetic preference: ${input.aesthetic}
Themes: ${input.themes.join(", ")}
Food preference: ${input.food}
Weather preference: ${input.weather}
Travel dates: ${input.startDate} to ${input.endDate} (${input.days} days)
Starting location: ${input.location}
Trip planning mode: ${input.trip_goal}
User provided destination: ${input.destination_location || "None"}
Trip type selected: ${inferredTripType}
Assume the traveler is a citizen of the country in the starting location.
Detected origin country: ${originCountry || "Unknown"}
Detected destination country: ${destinationCountry || "Unknown"}
Must avoid: ${input.must_avoid || "None specified"}
Nearby value destinations from this origin: ${nearbyValueOptionsText}
Traveling with: ${input.companions}
Personality traits (1-5): Spontaneity: ${input.personality.spontaneity}, Organization: ${input.personality.organization}, Curiosity: ${input.personality.curiosity}

Generate a personalized travel plan.

Requirements:
${hasExplicitDestination ? "Use the provided destination and keep itinerary realistic for that destination." : "Pick ONE destination that fits the weather preference for the given dates and budget."}
Create a trip theme name.
Match daily energy levels.
Include a realistic packing list.
Add general document reminders (passport, ID, visas if international).
Each itinerary item MUST include a specific time (e.g., "09:00 AM", "02:30 PM").
Use the selected budget currency strength when deciding destination affordability.
If budget currency is weak, bias toward better-value destinations and cost-efficient routing.
If budget currency is strong, wider destination options are acceptable but still stay realistic.
Respect budget mode and whether flights are included in budget.
Respect max flight duration when selecting/confirming destination and daily plan feasibility.
Respect must-avoid constraints.
Do not assume proximity to any specific country solely from the chosen currency; use starting location geography and trip type first.
${seniorCitizenGuidance}
${tripTypeGuidance}
${destinationPlanningGuidance}

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

  app.post(api.trips.recommend.path, async (req, res) => {
    try {
      const input = api.trips.recommend.input.parse(req.body);
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

      const prompt = `
You are a travel recommendation engine.
Return exactly 3 ranked destination options for this traveler.

User inputs:
- Trip planning mode: ${input.trip_goal}
- Starting location: ${input.location}
- Trip type: ${input.trip_type}
- Number of people: ${input.number_of_people}
- Budget amount: ${input.budget_amount} ${input.currency}
- Budget mode: ${input.budget_mode}
- Includes flights: ${input.includes_flights ? "yes" : "no"}
- Max flight duration: ${input.max_flight_hours} hours
- Comfort level: ${input.comfort_level}
- Companions: ${input.companions}
- Must avoid: ${input.must_avoid || "None specified"}
- Dates: ${input.startDate} to ${input.endDate} (${input.days} days)
- Vibe factors (1-5): energy=${input.energy}, activity=${input.activity}, social=${input.social}, aesthetic=${input.aesthetic}
- Themes: ${input.themes.join(", ")}
- Food: ${input.food}
- Weather: ${input.weather}
- Personality: spontaneity=${input.personality.spontaneity}, organization=${input.personality.organization}, curiosity=${input.personality.curiosity}

Rules:
- Output exactly 3 options sorted by total_score descending.
- Each metric including total_score must be on a 1 to 10 scale.
- total_score must be a normalized composite score (not a sum beyond 10).
- If trip planning mode is know_destination and destination is given (${input.destination_location || "none"}), option 1 MUST be that destination.
- Enforce trip type domestic/international from starting location country.
- Respect must-avoid and max flight duration.
- Be budget realistic (include budget ranges).

Return only JSON with this exact schema:
{
  "options": [
    {
      "destination": "",
      "country": "",
      "summary": "",
      "estimated_budget": { "low": 0, "high": 0, "currency": "${input.currency}" },
      "metrics": {
        "vibe_fit": 1,
        "affordability": 1,
        "travel_convenience": 1,
        "safety_accessibility": 1,
        "total_score": 1
      }
    }
  ]
}
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

      const normalized = normalizeRecommendationPayload(JSON.parse(content), input.currency);
      const parsed = destinationRecommendationResponseSchema.parse(normalized);
      return res.json(parsed);
    } catch (err) {
      console.error("Error recommending destinations:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      return res.status(500).json({ message: "Failed to recommend destinations" });
    }
  });

  return httpServer;
}

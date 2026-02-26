import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@shared/routes";
import { tripRequestSchema, type TripRequest } from "@shared/schema";
import { useGenerateTrip } from "@/hooks/use-trips";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { WizardStep } from "@/components/WizardStep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plane, Compass, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Helper for multi-step form
const STEPS = [
  { id: 'basics', title: 'The Basics', desc: 'Set your trip essentials so we can personalize recommendations.' },
  { id: 'details', title: 'Finishing Touches', desc: 'Share your interests and personality so we can refine your trip.' },
] as const;

function toLocalDateString(date: Date): string {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().split("T")[0];
}

type TripType = "domestic" | "international";
type TripGoal = "need_recommendation" | "know_destination";
type ComfortLevel = "low" | "medium" | "premium";

type LocationSuggestion = {
  city: string;
  country: string;
  displayName: string;
};

type DestinationOption = {
  destination: string;
  country: string;
  summary: string;
  estimated_budget: {
    low: number;
    high: number;
    currency: string;
  };
  metrics: {
    vibe_fit: number;
    affordability: number;
    travel_convenience: number;
    safety_accessibility: number;
    total_score: number;
  };
};

type CompanionOption = {
  value: string;
  label: string;
};

const CURRENCY_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 83,
  EUR: 90,
  GBP: 105,
  JPY: 0.56,
  AUD: 54,
  CAD: 61,
};

const CURRENCY_STRENGTH: Record<string, "weak" | "medium" | "strong"> = {
  INR: "weak",
  JPY: "weak",
  AUD: "medium",
  CAD: "medium",
  USD: "strong",
  EUR: "strong",
  GBP: "strong",
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

const COUNTRY_REGION: Record<string, "asia" | "europe" | "oceania" | "north_america" | "south_america" | "africa" | "middle_east"> = {
  Netherlands: "europe",
  India: "asia",
  Australia: "oceania",
  "New Zealand": "oceania",
  "United States": "north_america",
  Canada: "north_america",
  "United Kingdom": "europe",
  Germany: "europe",
  France: "europe",
  Italy: "europe",
  Spain: "europe",
  Japan: "asia",
  Singapore: "asia",
  Indonesia: "asia",
  Thailand: "asia",
  Malaysia: "asia",
  Vietnam: "asia",
  Philippines: "asia",
  "United Arab Emirates": "middle_east",
};

const COUNTRY_CURRENCY: Record<string, string> = {
  India: "INR",
  Netherlands: "EUR",
  Germany: "EUR",
  France: "EUR",
  Italy: "EUR",
  Spain: "EUR",
  "United Kingdom": "GBP",
  "United States": "USD",
  Canada: "CAD",
  Australia: "AUD",
  Japan: "JPY",
  Singapore: "USD",
  "United Arab Emirates": "USD",
};

const REGION_DEFAULT_CURRENCY: Record<string, string> = {
  asia: "INR",
  europe: "EUR",
  oceania: "AUD",
  north_america: "USD",
  south_america: "USD",
  africa: "USD",
  middle_east: "USD",
  global: "INR",
};

const DOMESTIC_COST_MULTIPLIER_BY_COUNTRY: Record<string, number> = {
  Netherlands: 1.25,
  India: 0.85,
  Australia: 1.35,
  "New Zealand": 1.35,
  "United States": 1.4,
  Canada: 1.3,
  "United Kingdom": 1.3,
  Singapore: 1.35,
  Japan: 1.25,
};

function normalizeCountryName(country?: string): string | undefined {
  if (!country) return undefined;
  const trimmed = country.trim();
  if (!trimmed) return undefined;
  return COUNTRY_ALIASES[trimmed] || trimmed;
}

const COMPANION_SIZE: Record<string, number> = {
  Solo: 1,
  Couple: 2,
  "Family with Kids": 3.5,
  "Family of Adults": 3,
  "Friends Group": 4,
  "Senior Citizen Friendly": 2,
};

function getCountryFromLocation(location: string): string | undefined {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  return normalizeCountryName(parts[parts.length - 1]);
}

function getRegionFromCountry(
  country?: string,
): "asia" | "oceania" | "europe" | "north_america" | "south_america" | "africa" | "middle_east" | "global" {
  if (!country) return "global";
  return COUNTRY_REGION[country] || "global";
}

function getSuggestedCurrencyFromLocation(location: string): string {
  const country = getCountryFromLocation(location);
  if (country && COUNTRY_CURRENCY[country]) {
    return COUNTRY_CURRENCY[country];
  }
  const region = getRegionFromCountry(country);
  return REGION_DEFAULT_CURRENCY[region] || "INR";
}

function getInternationalOriginMultiplier(country?: string): number {
  const region = getRegionFromCountry(country);
  switch (region) {
    case "oceania":
      return 1.15;
    case "europe":
      return 1.18;
    case "north_america":
      return 1.2;
    case "middle_east":
      return 1.05;
    case "africa":
      return 1.0;
    case "south_america":
      return 1.1;
    case "asia":
      return 1.0;
    case "global":
    default:
      return 1.1;
  }
}

function getCurrencyStrengthMultiplier(currency: string): number {
  const strength = CURRENCY_STRENGTH[currency] ?? "medium";
  if (strength === "strong") return 0.9;
  if (strength === "weak") return 1.1;
  return 1.0;
}

function estimateBudgetRangeInInr({
  days,
  numberOfPeople,
  tripType,
  currency,
  startLocation,
  comfortLevel,
  includesFlights,
  maxFlightHours,
}: {
  days: number;
  numberOfPeople: number;
  tripType: TripType;
  currency: string;
  startLocation: string;
  comfortLevel: ComfortLevel;
  includesFlights: boolean;
  maxFlightHours: number;
}): { low: number; high: number } {
  const travelers = Math.max(1, numberOfPeople);
  const domestic = tripType === "domestic";
  const originCountry = getCountryFromLocation(startLocation);

  const perDayLow = domestic ? 1200 : 2500;
  const perDayHigh = domestic ? 3000 : 6500;
  const fixedLow = domestic ? 3000 : 12000;
  const fixedHigh = domestic ? 8000 : 30000;

  const baseLow = travelers * (days * perDayLow + fixedLow);
  const baseHigh = travelers * (days * perDayHigh + fixedHigh);

  const geoMultiplier = domestic
    ? DOMESTIC_COST_MULTIPLIER_BY_COUNTRY[originCountry || ""] || 1
    : getInternationalOriginMultiplier(originCountry);
  const currencyMultiplier = domestic ? 1 : getCurrencyStrengthMultiplier(currency);
  const comfortMultiplier =
    comfortLevel === "low" ? 0.85 : comfortLevel === "premium" ? 1.35 : 1;
  const flightBudgetMultiplier = includesFlights ? 1 : 0.78;
  const flightDurationMultiplier =
    tripType === "international" ? (maxFlightHours <= 6 ? 0.9 : maxFlightHours >= 12 ? 1.1 : 1) : 1;

  const low = Math.round(
    baseLow *
      geoMultiplier *
      currencyMultiplier *
      comfortMultiplier *
      flightBudgetMultiplier *
      flightDurationMultiplier,
  );
  const high = Math.round(
    baseHigh *
      geoMultiplier *
      currencyMultiplier *
      comfortMultiplier *
      flightBudgetMultiplier *
      flightDurationMultiplier,
  );
  return { low, high };
}

function convertInrToCurrency(amountInInr: number, currency: string): number {
  const rate = CURRENCY_TO_INR[currency] ?? 1;
  return amountInInr / rate;
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString("en-IN")}`;
  }
}

function getBudgetGuidanceNote({
  currency,
  tripType,
  startLocation,
}: {
  currency: string;
  tripType: TripType;
  startLocation: string;
}): string {
  const strength = CURRENCY_STRENGTH[currency] ?? "medium";
  const country = getCountryFromLocation(startLocation);

  if (tripType === "domestic") {
    return `For ${country || "your country"}, consider off-peak dates and budget-friendly domestic routes to stretch value.`;
  }
  if (strength === "weak") {
    return `From ${country || "your origin"}, prioritize geographically nearby and value-focused international options, and consider off-peak travel.`;
  }
  if (strength === "strong") {
    return `Your selected currency has strong purchasing power. From ${country || "your origin"}, compare nearby-value and premium international options while keeping the trip practical.`;
  }
  return `From ${country || "your origin"}, balance route distance, seasonality, and flight costs to stay within budget.`;
}

function deriveBudgetTierFromRange(
  budgetInInr: number,
  rangeInInr: { low: number; high: number },
): ComfortLevel {
  if (budgetInInr < rangeInInr.low) return "low";
  if (budgetInInr > rangeInInr.high) return "premium";
  return "medium";
}

export default function Home() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [destinationSuggestions, setDestinationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isDestinationLoading, setIsDestinationLoading] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [isAnalysingBasics, setIsAnalysingBasics] = useState(false);
  const [budgetFeedback, setBudgetFeedback] = useState<string | null>(null);
  const [allowProceedAnyway, setAllowProceedAnyway] = useState(false);
  const [isFindingDestinations, setIsFindingDestinations] = useState(false);
  const [destinationOptions, setDestinationOptions] = useState<DestinationOption[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>("");
  const skipNextLocationSearchRef = useRef(false);
  const skipNextDestinationSearchRef = useRef(false);
  const generateTrip = useGenerateTrip();
  const todayDate = new Date();

  const form = useForm<TripRequest>({
    resolver: zodResolver(tripRequestSchema),
    defaultValues: {
      trip_goal: "need_recommendation",
      comfort_level: "medium",
      trip_type: "domestic",
      location: "",
      destination_location: "",
      number_of_people: 2,
      includes_flights: true,
      max_flight_hours: 8,
      days: 3,
      budget_amount: 1000,
      currency: "INR",
      companions: "Couple",
      energy: 3,
      activity: 3,
      social: 3,
      aesthetic: 3,
      themes: [],
      food: "Local Street Food",
      weather: "Sunny & Warm",
      startDate: toLocalDateString(todayDate),
      endDate: toLocalDateString(new Date(todayDate.getTime() + 3 * 24 * 60 * 60 * 1000)),
      personality: {
        spontaneity: 3,
        organization: 3,
        curiosity: 3,
      }
    },
    mode: "onChange"
  });

  const nextStep = async () => {
    // Validate current step fields before proceeding
    let fieldsToValidate: (keyof TripRequest)[] = [];
    if (currentStep === 0) {
      fieldsToValidate = [
        'trip_goal',
        'location',
        'number_of_people',
        'includes_flights',
        'days',
        'companions',
        'currency',
        'budget_amount',
        'startDate',
        'endDate',
      ];
      if (form.getValues("trip_goal") !== "know_destination") {
        fieldsToValidate.push("trip_type");
      }
      if (form.getValues("trip_goal") === "know_destination") {
        fieldsToValidate.push("destination_location");
      }
      if (form.getValues("includes_flights") && form.getValues("trip_goal") !== "know_destination") {
        fieldsToValidate.push("max_flight_hours");
      }
    }
    const isValid = await form.trigger(fieldsToValidate);
    if (!isValid) return;

    if (currentStep === 0) {
      setIsAnalysingBasics(true);
      setBudgetFeedback(null);
      setAllowProceedAnyway(false);

      await new Promise((resolve) => setTimeout(resolve, 700));

      const values = form.getValues();
      const tripDays = Math.max(
        1,
        Math.ceil(
          (new Date(values.endDate).getTime() - new Date(values.startDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      const budgetInInr = values.budget_amount * (CURRENCY_TO_INR[values.currency] ?? 1);
      const effectiveTripType: TripType =
        values.trip_goal === "know_destination" && values.destination_location
          ? (getCountryFromLocation(values.location) === getCountryFromLocation(values.destination_location)
              ? "domestic"
              : "international")
          : values.trip_type;
      const recommendedRangeInInr = estimateBudgetRangeInInr({
        days: tripDays,
        numberOfPeople: values.number_of_people,
        tripType: effectiveTripType,
        currency: values.currency,
        startLocation: values.location,
        comfortLevel: values.comfort_level,
        includesFlights: values.includes_flights,
        maxFlightHours: values.max_flight_hours ?? 8,
      });
      const lowInSelectedCurrency = convertInrToCurrency(
        recommendedRangeInInr.low,
        values.currency,
      );
      const highInSelectedCurrency = convertInrToCurrency(
        recommendedRangeInInr.high,
        values.currency,
      );
      const guidanceNote = getBudgetGuidanceNote({
        currency: values.currency,
        tripType: effectiveTripType,
        startLocation: values.location,
      });
      const derivedComfortLevel = deriveBudgetTierFromRange(budgetInInr, recommendedRangeInInr);
      form.setValue("comfort_level", derivedComfortLevel, { shouldValidate: true });

      if (budgetInInr < recommendedRangeInInr.low) {
        const closeToRange = budgetInInr >= recommendedRangeInInr.low * 0.75;
        const tooInsufficientWithFlights =
          values.includes_flights && budgetInInr < recommendedRangeInInr.low * 0.9;
        setBudgetFeedback(
          `Your budget looks low for this setup. A more realistic range is ${formatAmount(lowInSelectedCurrency, values.currency)} to ${formatAmount(highInSelectedCurrency, values.currency)} for ${tripDays} day(s), ${values.number_of_people} traveler(s), and ${effectiveTripType} travel. ${guidanceNote}`,
        );
        setAllowProceedAnyway(closeToRange && !tooInsufficientWithFlights);
        setIsAnalysingBasics(false);
        return;
      }
      setIsAnalysingBasics(false);
    }

    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const getDestinationSelectionLabel = (
    option: DestinationOption,
    tripType: TripType,
  ): string => {
    if (tripType === "international") {
      return option.country || option.destination;
    }
    return `${option.destination}, ${option.country}`;
  };

  const onSubmit = async (data: TripRequest) => {
    if (data.trip_goal === "need_recommendation") {
      if (!destinationOptions.length) {
        try {
          setIsFindingDestinations(true);
          const response = await fetch(api.trips.recommend.path, {
            method: api.trips.recommend.method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || "Failed to find destinations");
          }
          const result = api.trips.recommend.responses[200].parse(await response.json());
          setDestinationOptions(result.options);
          if (result.options[0]) {
            setSelectedDestination(
              getDestinationSelectionLabel(result.options[0], effectiveRecommendationTripType),
            );
          }
          return;
        } catch (error) {
          toast({
            title: "Destination Search Failed",
            description:
              error instanceof Error ? error.message : "Failed to find destinations",
            variant: "destructive",
          });
          return;
        } finally {
          setIsFindingDestinations(false);
        }
      }
      if (!selectedDestination) {
        toast({
          title: "Select a Destination",
          description: "Pick one recommended destination to continue.",
          variant: "destructive",
        });
        return;
      }
      generateTrip.mutate({
        ...data,
        trip_goal: "know_destination",
        destination_location: selectedDestination,
      });
      return;
    }
    generateTrip.mutate(data);
  };

  const THEMES = ["Nature", "City", "Adventure", "Relaxation", "Culture", "History", "Nightlife", "Shopping"];
  const COMPANIONS: CompanionOption[] = [
    { value: "Solo", label: "Solo Traveler" },
    { value: "Couple", label: "Couple" },
    { value: "Family with Kids", label: "Family with Kids" },
    { value: "Family of Adults", label: "Family of Adults" },
    { value: "Friends Group", label: "Friends Group" },
    { value: "Senior Citizen Friendly", label: "Senior Citizen Friendly" },
  ];
  const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "INR"];
  const todayDateString = toLocalDateString(todayDate);
  const tripGoalValue = form.watch("trip_goal");
  const startDateValue = form.watch("startDate");
  const endDateValue = form.watch("endDate");
  const locationValue = form.watch("location");
  const destinationValue = form.watch("destination_location");
  const themesValue = form.watch("themes");
  const foodValue = form.watch("food");
  const weatherValue = form.watch("weather");
  const currencyValue = form.watch("currency");
  const budgetAmountValue = form.watch("budget_amount");
  const companionsValue = form.watch("companions");
  const manualTripType = form.watch("trip_type");
  const minEndDate = startDateValue
    ? new Date(new Date(startDateValue).getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]
    : undefined;
  const locationField = form.register("location");
  const destinationField = form.register("destination_location");

  useEffect(() => {
    const query = locationValue?.trim() || "";
    if (skipNextLocationSearchRef.current) {
      skipNextLocationSearchRef.current = false;
      return;
    }
    if (query.length < 2) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setIsLocationLoading(true);
        const res = await fetch(`/api/location-suggestions?query=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setLocationSuggestions([]);
          return;
        }
        const data = (await res.json()) as { suggestions: LocationSuggestion[] };
        setLocationSuggestions(data.suggestions || []);
        setShowLocationSuggestions((data.suggestions || []).length > 0);
      } catch {
        setLocationSuggestions([]);
      } finally {
        setIsLocationLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [locationValue]);

  useEffect(() => {
    const query = destinationValue?.trim() || "";
    if (skipNextDestinationSearchRef.current) {
      skipNextDestinationSearchRef.current = false;
      return;
    }
    if (tripGoalValue !== "know_destination" || query.length < 2) {
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setIsDestinationLoading(true);
        const res = await fetch(`/api/location-suggestions?query=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setDestinationSuggestions([]);
          return;
        }
        const data = (await res.json()) as { suggestions: LocationSuggestion[] };
        setDestinationSuggestions(data.suggestions || []);
        setShowDestinationSuggestions((data.suggestions || []).length > 0);
      } catch {
        setDestinationSuggestions([]);
      } finally {
        setIsDestinationLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [destinationValue, tripGoalValue]);

  useEffect(() => {
    if (tripGoalValue !== "know_destination") return;
    const fromCountry = getCountryFromLocation(locationValue || "");
    const toCountry = getCountryFromLocation(destinationValue || "");
    if (!fromCountry || !toCountry) return;

    const inferredTripType: TripType =
      fromCountry.toLowerCase() === toCountry.toLowerCase() ? "domestic" : "international";
    form.setValue("trip_type", inferredTripType, { shouldValidate: true });
  }, [tripGoalValue, locationValue, destinationValue, form]);

  useEffect(() => {
    if (companionsValue === "Solo" && form.getValues("number_of_people") !== 1) {
      form.setValue("number_of_people", 1, { shouldValidate: true });
      return;
    }
    if (companionsValue === "Couple" && form.getValues("number_of_people") !== 2) {
      form.setValue("number_of_people", 2, { shouldValidate: true });
    }
  }, [companionsValue, form]);

  useEffect(() => {
    const selectedCurrency = getSuggestedCurrencyFromLocation(locationValue || "");
    if (form.getValues("currency") !== selectedCurrency) {
      form.setValue("currency", selectedCurrency, { shouldValidate: true });
    }
  }, [locationValue, form]);

  useEffect(() => {
    setDestinationOptions([]);
    setSelectedDestination("");
  }, [
    tripGoalValue,
    themesValue,
    foodValue,
    weatherValue,
    currencyValue,
    budgetAmountValue,
    startDateValue,
    endDateValue,
    locationValue,
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep]);

  const effectiveRecommendationTripType: TripType =
    tripGoalValue === "know_destination" && destinationValue
      ? getCountryFromLocation(locationValue || "") === getCountryFromLocation(destinationValue || "")
        ? "domestic"
        : "international"
      : (manualTripType as TripType);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex justify-between mb-2">
            {STEPS.map((step, idx) => (
              <span 
                key={step.id} 
                className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${
                  idx <= currentStep ? 'text-primary' : 'text-muted-foreground/50'
                }`}
              >
                Step {idx + 1}
              </span>
            ))}
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <AnimatePresence mode="wait">
            {currentStep === 0 && (
              <WizardStep key="step1" title={STEPS[0].title} description={STEPS[0].desc}>
                <div className="grid gap-6">
                  <div className="space-y-3">
                    <Label>Trip Planning Mode</Label>
                    <RadioGroup
                      value={form.watch("trip_goal")}
                      onValueChange={(val) =>
                        form.setValue("trip_goal", val as TripGoal, { shouldValidate: true })
                      }
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      <label className="flex items-start gap-3 rounded-md border border-input p-4 cursor-pointer">
                        <RadioGroupItem value="need_recommendation" id="trip_goal_need_recommendation" />
                        <div>
                          <p className="font-medium">I want destination recommendations</p>
                          <p className="text-sm text-muted-foreground">We will suggest where to go based on your vibe, budget, and preferences.</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 rounded-md border border-input p-4 cursor-pointer">
                        <RadioGroupItem value="know_destination" id="trip_goal_know_destination" />
                        <div>
                          <p className="font-medium">I already know my destination</p>
                          <p className="text-sm text-muted-foreground">We will tailor an extensive itinerary for your chosen destination.</p>
                        </div>
                      </label>
                    </RadioGroup>
                    {form.formState.errors.trip_goal && (
                      <p className="text-sm text-destructive">{form.formState.errors.trip_goal.message}</p>
                    )}
                  </div>

                  {tripGoalValue !== "know_destination" ? (
                    <div className="space-y-3">
                      <Label>Travel Type</Label>
                      <RadioGroup
                        value={form.watch("trip_type")}
                        onValueChange={(val) =>
                          form.setValue("trip_type", val as TripType, { shouldValidate: true })
                        }
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      >
                        <label className="flex items-center gap-3 rounded-md border border-input p-4 cursor-pointer">
                          <RadioGroupItem value="domestic" id="trip_type_domestic" />
                          <span className="font-medium">Domestic</span>
                        </label>
                        <label className="flex items-center gap-3 rounded-md border border-input p-4 cursor-pointer">
                          <RadioGroupItem value="international" id="trip_type_international" />
                          <span className="font-medium">International</span>
                        </label>
                      </RadioGroup>
                      {form.formState.errors.trip_type && (
                        <p className="text-sm text-destructive">{form.formState.errors.trip_type.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-md border border-input p-4 text-sm text-muted-foreground">
                      Travel type will be auto-detected based on your starting and destination countries.
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="location">Starting Location</Label>
                    <div className="relative">
                      <Input
                        id="location"
                        placeholder="e.g. Chennai, India"
                        className="h-12 text-lg pr-10"
                        required
                        autoComplete="off"
                        spellCheck={false}
                        name="starting_location_search"
                        {...locationField}
                        onFocus={() => setShowLocationSuggestions(locationSuggestions.length > 0)}
                        onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 120)}
                        onChange={(e) => {
                          skipNextLocationSearchRef.current = false;
                          locationField.onChange(e);
                          setShowLocationSuggestions(true);
                        }}
                      />
                      {locationValue?.trim() && (
                        <button
                          type="button"
                          aria-label="Clear starting location"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            skipNextLocationSearchRef.current = false;
                            form.setValue("location", "", { shouldValidate: true });
                            setLocationSuggestions([]);
                            setShowLocationSuggestions(false);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      {isLocationLoading && (
                        <p className="text-xs text-muted-foreground mt-2">Searching locations...</p>
                      )}
                      {showLocationSuggestions && locationSuggestions.length > 0 && (
                        <div className="absolute top-full mt-1 z-[120] w-full rounded-md border bg-popover shadow-md max-h-60 overflow-auto">
                          {locationSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.displayName}
                              type="button"
                              className="block w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                skipNextLocationSearchRef.current = true;
                                form.setValue("location", suggestion.displayName, { shouldValidate: true });
                                setShowLocationSuggestions(false);
                                setLocationSuggestions([]);
                              }}
                            >
                              {suggestion.city}, {suggestion.country}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {form.formState.errors.location && (
                      <p className="text-sm text-destructive">{form.formState.errors.location.message}</p>
                    )}
                  </div>

                  {tripGoalValue === "know_destination" && (
                    <div className="space-y-2">
                      <Label htmlFor="destination_location">Destination Location</Label>
                      <div className="relative">
                        <Input
                          id="destination_location"
                          placeholder="e.g. Paris, France"
                          className="h-12 text-lg pr-10"
                          required
                          autoComplete="off"
                          spellCheck={false}
                          name="destination_location_search"
                          {...destinationField}
                          onFocus={() => setShowDestinationSuggestions(destinationSuggestions.length > 0)}
                          onBlur={() => setTimeout(() => setShowDestinationSuggestions(false), 120)}
                          onChange={(e) => {
                            skipNextDestinationSearchRef.current = false;
                            destinationField.onChange(e);
                            setShowDestinationSuggestions(true);
                          }}
                        />
                        {destinationValue?.trim() && (
                          <button
                            type="button"
                            aria-label="Clear destination location"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              skipNextDestinationSearchRef.current = false;
                              form.setValue("destination_location", "", { shouldValidate: true });
                              setDestinationSuggestions([]);
                              setShowDestinationSuggestions(false);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        {isDestinationLoading && (
                          <p className="text-xs text-muted-foreground mt-2">Searching destinations...</p>
                        )}
                        {showDestinationSuggestions && destinationSuggestions.length > 0 && (
                          <div className="absolute top-full mt-1 z-[120] w-full rounded-md border bg-popover shadow-md max-h-60 overflow-auto">
                            {destinationSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.displayName}
                                type="button"
                                className="block w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  skipNextDestinationSearchRef.current = true;
                                  form.setValue("destination_location", suggestion.displayName, { shouldValidate: true });
                                  setShowDestinationSuggestions(false);
                                  setDestinationSuggestions([]);
                                }}
                              >
                                {suggestion.city}, {suggestion.country}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {form.formState.errors.destination_location && (
                        <p className="text-sm text-destructive">{form.formState.errors.destination_location.message}</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select 
                        onValueChange={(val) =>
                          form.setValue("currency", val, { shouldValidate: true })
                        }
                        defaultValue={form.getValues("currency")}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select Currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.currency && (
                        <p className="text-sm text-destructive">{form.formState.errors.currency.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="budget_amount">Total Trip Budget</Label>
                      <Input 
                        id="budget_amount" 
                        type="number" 
                        className="h-12"
                        required
                        min={1}
                        {...form.register("budget_amount", { valueAsNumber: true })}
                      />
                      {form.formState.errors.budget_amount && (
                        <p className="text-sm text-destructive">{form.formState.errors.budget_amount.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Includes Flights</Label>
                      <RadioGroup
                        value={form.watch("includes_flights") ? "yes" : "no"}
                        onValueChange={(val) =>
                          form.setValue("includes_flights", val === "yes", {
                            shouldValidate: true,
                          })
                        }
                        className="grid grid-cols-2 gap-4"
                      >
                        <label className="flex items-center gap-3 rounded-md border border-input p-3 cursor-pointer">
                          <RadioGroupItem value="yes" id="includes_flights_yes" />
                          <span>Yes</span>
                        </label>
                        <label className="flex items-center gap-3 rounded-md border border-input p-3 cursor-pointer">
                          <RadioGroupItem value="no" id="includes_flights_no" />
                          <span>No</span>
                        </label>
                      </RadioGroup>
                    </div>
                    {form.watch("includes_flights") && tripGoalValue !== "know_destination" && (
                      <div className="space-y-2">
                        <Label htmlFor="max_flight_hours">Max Flight Duration (hours)</Label>
                        <Input
                          id="max_flight_hours"
                          type="number"
                          min={1}
                          max={24}
                          required
                          className="h-12"
                          {...form.register("max_flight_hours", { valueAsNumber: true })}
                        />
                        {form.formState.errors.max_flight_hours && (
                          <p className="text-sm text-destructive">{form.formState.errors.max_flight_hours.message}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Travel Dates</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">From</Label>
                        <Input
                          type="date"
                          className="h-12"
                          required
                          min={todayDateString}
                          {...form.register("startDate")}
                          onChange={(e) => {
                            const selectedStart = e.target.value;
                            form.setValue("startDate", selectedStart, { shouldValidate: true });
                            if (!selectedStart) return;
                            const minAllowedEnd = new Date(new Date(selectedStart).getTime() + 24 * 60 * 60 * 1000)
                              .toISOString()
                              .split("T")[0];
                            const currentEnd = form.getValues("endDate");
                            if (!currentEnd || new Date(currentEnd) <= new Date(selectedStart)) {
                              form.setValue("endDate", minAllowedEnd, { shouldValidate: true });
                              form.setValue("days", 1);
                              return;
                            }
                            const start = new Date(e.target.value);
                            const end = new Date(form.getValues("endDate"));
                            if (end > start) {
                              const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                              form.setValue("days", diff);
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">To</Label>
                        <Input
                          type="date"
                          className="h-12"
                          required
                          min={minEndDate}
                          {...form.register("endDate")}
                          onChange={(e) => {
                            form.setValue("endDate", e.target.value, { shouldValidate: true });
                            const end = new Date(e.target.value);
                            const start = new Date(form.getValues("startDate"));
                            if (end > start) {
                              const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                              form.setValue("days", diff);
                            }
                          }}
                        />
                      </div>
                    </div>
                    {(form.formState.errors.startDate || form.formState.errors.endDate) && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.startDate?.message || form.formState.errors.endDate?.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Travel Setup</Label>
                      <Select
                        onValueChange={(val) =>
                          form.setValue("companions", val, { shouldValidate: true })
                        }
                        defaultValue={form.getValues("companions")}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="How are you traveling?" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPANIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.companions && (
                        <p className="text-sm text-destructive">{form.formState.errors.companions.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="number_of_people">Number of People</Label>
                      <Input
                        id="number_of_people"
                        type="number"
                        min={1}
                        max={companionsValue === "Solo" ? 1 : companionsValue === "Couple" ? 2 : undefined}
                        disabled={companionsValue === "Solo" || companionsValue === "Couple"}
                        className="h-12"
                        required
                        {...form.register("number_of_people", { valueAsNumber: true })}
                      />
                      {(companionsValue === "Solo" || companionsValue === "Couple") && (
                        <p className="text-xs text-muted-foreground">
                          {companionsValue === "Solo"
                            ? "Solo travel is fixed to 1 person."
                            : "Couple travel is fixed to 2 people."}
                        </p>
                      )}
                      {form.formState.errors.number_of_people && (
                        <p className="text-sm text-destructive">{form.formState.errors.number_of_people.message}</p>
                      )}
                    </div>
                  </div>

                  {budgetFeedback && (
                    <Alert variant="destructive">
                      <AlertTitle>Budget May Be Insufficient</AlertTitle>
                      <AlertDescription className="space-y-3">
                        <p>{budgetFeedback}</p>
                        {allowProceedAnyway && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setBudgetFeedback(null);
                              setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
                            }}
                          >
                            Proceed Anyway
                          </Button>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="must_avoid">Must Avoid (Optional)</Label>
                    <Textarea
                      id="must_avoid"
                      placeholder="e.g. avoid nightlife, avoid heavy walking, avoid humid weather, no long flights"
                      className="min-h-[92px]"
                      {...form.register("must_avoid")}
                    />
                  </div>
                </div>
              </WizardStep>
            )}

            {currentStep === 1 && (
              <WizardStep key="step2" title={STEPS[1].title} description={STEPS[1].desc}>
                <div className="space-y-8">
                  <div className="space-y-4">
                    <Label className="text-base">What interests you? (Select at least 1)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {THEMES.map((theme) => (
                        <div key={theme} className="flex items-center space-x-2">
                          <Checkbox 
                            id={theme} 
                            checked={form.watch("themes")?.includes(theme)}
                            onCheckedChange={(checked) => {
                              const current = form.getValues("themes") || [];
                              if (checked) {
                                form.setValue("themes", [...current, theme]);
                              } else {
                                form.setValue("themes", current.filter(t => t !== theme));
                              }
                            }}
                          />
                          <Label htmlFor={theme} className="cursor-pointer font-normal">{theme}</Label>
                        </div>
                      ))}
                    </div>
                    {form.formState.errors.themes && (
                      <p className="text-sm text-destructive">Please select at least one theme</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="food">Dietary Preferences</Label>
                      <Select 
                        onValueChange={(val) => form.setValue("food", val)} 
                        defaultValue={form.getValues("food")}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select dietary preference" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Vegetarian", "Vegan", "Sea Food", "Halal", "Gluten-Free", "No Restrictions"].map(d => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weather">Preferred Weather</Label>
                      <Input id="weather" {...form.register("weather")} placeholder="e.g. Cool & breezy" className="h-12" />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <Label className="text-lg font-semibold">Personality Evaluation</Label>
                    <PreferenceSlider 
                      label="Spontaneity" 
                      leftLabel="Planned" 
                      rightLabel="Spontaneous"
                      value={form.watch("personality.spontaneity")}
                      onChange={(val) => form.setValue("personality.spontaneity", val[0])}
                      icon={<Sparkles className="w-5 h-5 text-primary" />}
                    />
                    <PreferenceSlider 
                      label="Organization" 
                      leftLabel="Go with the flow" 
                      rightLabel="Highly Organized"
                      value={form.watch("personality.organization")}
                      onChange={(val) => form.setValue("personality.organization", val[0])}
                      icon={<Compass className="w-5 h-5 text-primary" />}
                    />
                    <PreferenceSlider 
                      label="Curiosity" 
                      leftLabel="Familiar" 
                      rightLabel="Adventurous"
                      value={form.watch("personality.curiosity")}
                      onChange={(val) => form.setValue("personality.curiosity", val[0])}
                      icon={<Plane className="w-5 h-5 text-primary" />}
                    />
                  </div>
                </div>
              </WizardStep>
            )}
          </AnimatePresence>

          {currentStep === 1 && tripGoalValue === "need_recommendation" && destinationOptions.length > 0 && (
            <div className="mt-8 space-y-4">
              <Label className="text-lg font-semibold">Top Destination Options</Label>
              <div className="grid gap-4">
                {destinationOptions.map((option, index) => {
                  const destinationLabel = getDestinationSelectionLabel(
                    option,
                    effectiveRecommendationTripType,
                  );
                  const isSelected = selectedDestination === destinationLabel;
                  return (
                    <button
                      key={`${destinationLabel}-${index}`}
                      type="button"
                      className={`w-full text-left rounded-lg border p-4 transition ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-input hover:border-primary/40"
                      }`}
                      onClick={() => setSelectedDestination(destinationLabel)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Rank #{index + 1}</p>
                          <p className="text-lg font-semibold">{destinationLabel}</p>
                          <p className="text-sm text-muted-foreground mt-1">{option.summary}</p>
                          <p className="text-sm mt-2">
                            Budget: {formatAmount(option.estimated_budget.low, option.estimated_budget.currency)} -{" "}
                            {formatAmount(option.estimated_budget.high, option.estimated_budget.currency)}
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-semibold">Score {option.metrics.total_score}/10</p>
                          <p className="text-muted-foreground">Vibe {option.metrics.vibe_fit}/10</p>
                          <p className="text-muted-foreground">Affordable {option.metrics.affordability}/10</p>
                          <p className="text-muted-foreground">Convenience {option.metrics.travel_convenience}/10</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={prevStep}
              disabled={currentStep === 0 || generateTrip.isPending || isAnalysingBasics}
              className="w-32"
            >
              Back
            </Button>

            {currentStep < STEPS.length - 1 ? (
              <Button 
                type="button" 
                onClick={nextStep}
                disabled={isAnalysingBasics}
                className="w-32"
              >
                {isAnalysingBasics ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analysing...
                  </>
                ) : (
                  "Next"
                )}
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={generateTrip.isPending || isFindingDestinations}
                className="w-40 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5"
              >
                {isFindingDestinations ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finding...
                  </>
                ) : generateTrip.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Planning...
                  </>
                ) : currentStep === 1 && tripGoalValue === "need_recommendation" && destinationOptions.length === 0 ? (
                  "Find Destinations"
                ) : currentStep === 1 && tripGoalValue === "need_recommendation" ? (
                  "Generate Itinerary"
                ) : (
                  "Generate Trip"
                )}
              </Button>
            )}
          </div>
        </form>
      </div>
    </Layout>
  );
}

function PreferenceSlider({ 
  label, 
  leftLabel, 
  rightLabel, 
  value, 
  onChange,
  icon
}: { 
  label: string; 
  leftLabel: string; 
  rightLabel: string; 
  value: number; 
  onChange: (val: number[]) => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <Label className="text-base font-semibold text-foreground/80">{label}</Label>
      </div>
      <Slider 
        min={1} 
        max={5} 
        step={1} 
        value={[value]} 
        onValueChange={onChange}
        className="py-2"
      />
      <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

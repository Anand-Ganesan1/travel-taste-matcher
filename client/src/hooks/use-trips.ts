import { useMutation } from "@tanstack/react-query";
import { api, type TripRequest, type TripResponse } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export function useGenerateTrip() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (data: TripRequest) => {
      // Simulate API delay for better UX if it's too fast, 
      // but OpenAI usually takes a few seconds anyway.
      const res = await fetch(api.trips.generate.path, {
        method: api.trips.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to generate itinerary");
      }

      // Validate response with Zod schema from shared routes
      return api.trips.generate.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      // Store result in sessionStorage to persist across simple navigations
      // without needing a complex global store for this MVP
      sessionStorage.setItem("lastTripResult", JSON.stringify(data));
      
      toast({
        title: "Itinerary Ready!",
        description: "Your personalized travel plan has been generated.",
      });
      
      setLocation("/results");
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { tripRequestSchema, type TripRequest } from "@shared/schema";
import { useGenerateTrip } from "@/hooks/use-trips";
import { Layout } from "@/components/Layout";
import { WizardStep } from "@/components/WizardStep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plane, Compass, Sparkles, Coffee } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Helper for multi-step form
const STEPS = [
  { id: 'basics', title: 'The Basics', desc: 'Where and when are you planning to go?' },
  { id: 'vibe', title: 'Your Travel Vibe', desc: 'Tell us how you like to travel.' },
  { id: 'details', title: 'Finishing Touches', desc: 'Specific interests and constraints.' },
] as const;

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const generateTrip = useGenerateTrip();

  const form = useForm<TripRequest>({
    resolver: zodResolver(tripRequestSchema),
    defaultValues: {
      location: "",
      days: 3,
      budget: 3,
      companions: "Couple",
      energy: 3,
      activity: 3,
      social: 3,
      aesthetic: 3,
      themes: [],
      food: "Local Street Food",
      weather: "Sunny & Warm",
    },
    mode: "onChange"
  });

  const nextStep = async () => {
    // Validate current step fields before proceeding
    let fieldsToValidate: (keyof TripRequest)[] = [];
    if (currentStep === 0) fieldsToValidate = ['location', 'days', 'companions'];
    if (currentStep === 1) fieldsToValidate = ['energy', 'budget', 'activity', 'social', 'aesthetic'];
    
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const onSubmit = (data: TripRequest) => {
    generateTrip.mutate(data);
  };

  const THEMES = ["Nature", "City", "Adventure", "Relaxation", "Culture", "History", "Nightlife", "Shopping"];
  const COMPANIONS = ["Solo", "Couple", "Family with Kids", "Friends Group"];

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
                  <div className="space-y-2">
                    <Label htmlFor="location">Dream Destination</Label>
                    <Input 
                      id="location" 
                      placeholder="e.g. Tokyo, Japan or Amalfi Coast" 
                      className="h-12 text-lg"
                      {...form.register("location")}
                    />
                    {form.formState.errors.location && (
                      <p className="text-sm text-destructive">{form.formState.errors.location.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="days">Duration (Days)</Label>
                      <Input 
                        id="days" 
                        type="number" 
                        min={1} 
                        max={30}
                        className="h-12"
                        {...form.register("days")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Companions</Label>
                      <Select 
                        onValueChange={(val) => form.setValue("companions", val)} 
                        defaultValue={form.getValues("companions")}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Who are you traveling with?" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPANIONS.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </WizardStep>
            )}

            {currentStep === 1 && (
              <WizardStep key="step2" title={STEPS[1].title} description={STEPS[1].desc}>
                <div className="space-y-8">
                  <PreferenceSlider 
                    label="Pace & Energy" 
                    leftLabel="Relaxed" 
                    rightLabel="Action Packed"
                    value={form.watch("energy")}
                    onChange={(val) => form.setValue("energy", val[0])}
                    icon={<Coffee className="w-5 h-5 text-primary" />}
                  />
                  
                  <PreferenceSlider 
                    label="Budget" 
                    leftLabel="Budget" 
                    rightLabel="Luxury"
                    value={form.watch("budget")}
                    onChange={(val) => form.setValue("budget", val[0])}
                    icon={<Sparkles className="w-5 h-5 text-primary" />}
                  />

                  <PreferenceSlider 
                    label="Activity Level" 
                    leftLabel="Leisurely" 
                    rightLabel="Intense"
                    value={form.watch("activity")}
                    onChange={(val) => form.setValue("activity", val[0])}
                    icon={<Compass className="w-5 h-5 text-primary" />}
                  />

                  <PreferenceSlider 
                    label="Social Vibe" 
                    leftLabel="Secluded" 
                    rightLabel="Party/Social"
                    value={form.watch("social")}
                    onChange={(val) => form.setValue("social", val[0])}
                    icon={<Plane className="w-5 h-5 text-primary" />}
                  />
                </div>
              </WizardStep>
            )}

            {currentStep === 2 && (
              <WizardStep key="step3" title={STEPS[2].title} description={STEPS[2].desc}>
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
                      <Label htmlFor="food">Food Preference</Label>
                      <Input id="food" {...form.register("food")} placeholder="e.g. Vegetarian friendly, Seafood..." className="h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weather">Preferred Weather</Label>
                      <Input id="weather" {...form.register("weather")} placeholder="e.g. Cool & breezy" className="h-12" />
                    </div>
                  </div>
                </div>
              </WizardStep>
            )}
          </AnimatePresence>

          <div className="mt-8 flex justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={prevStep}
              disabled={currentStep === 0 || generateTrip.isPending}
              className="w-32"
            >
              Back
            </Button>

            {currentStep < STEPS.length - 1 ? (
              <Button 
                type="button" 
                onClick={nextStep}
                className="w-32"
              >
                Next
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={generateTrip.isPending}
                className="w-40 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-lg shadow-accent/20 transition-all hover:-translate-y-0.5"
              >
                {generateTrip.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Planning...
                  </>
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

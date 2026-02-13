import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { TripResponse } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Calendar, CheckSquare, FileText, ArrowLeft, Sun, Moon, Coffee } from "lucide-react";
import { motion } from "framer-motion";

export default function Results() {
  const [trip, setTrip] = useState<TripResponse | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const saved = sessionStorage.getItem("lastTripResult");
    if (!saved) {
      setLocation("/");
      return;
    }
    try {
      setTrip(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to parse trip data", e);
      setLocation("/");
    }
  }, [setLocation]);

  if (!trip) return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        <Link href="/">
          <Button variant="ghost" className="pl-0 hover:pl-2 transition-all">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Create Another Trip
          </Button>
        </Link>

        {/* Hero Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden bg-primary text-primary-foreground p-8 md:p-12 shadow-xl shadow-primary/20"
        >
          <div className="relative z-10 space-y-4">
            <Badge variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0 uppercase tracking-widest text-xs">
              {trip.trip_theme}
            </Badge>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white leading-tight">
              {trip.destination}
            </h1>
            <div className="flex flex-wrap gap-2 pt-2">
              {trip.why_it_matches_you.map((reason, i) => (
                <Badge key={i} variant="outline" className="border-white/30 text-white bg-transparent">
                  {reason}
                </Badge>
              ))}
            </div>
          </div>
          
          {/* Decorative Background Pattern */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />
        </motion.div>

        <Tabs defaultValue="itinerary" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-14 bg-white border shadow-sm rounded-xl p-1 mb-8">
            <TabsTrigger value="itinerary" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-medium">
              <Calendar className="w-4 h-4 mr-2" />
              Itinerary
            </TabsTrigger>
            <TabsTrigger value="packing" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-medium">
              <CheckSquare className="w-4 h-4 mr-2" />
              Packing
            </TabsTrigger>
            <TabsTrigger value="docs" className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-medium">
              <FileText className="w-4 h-4 mr-2" />
              Docs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="itinerary" className="space-y-6">
            {trip.daily_itinerary.map((day, idx) => (
              <motion.div
                key={day.day}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-primary">
                  <CardHeader className="bg-muted/30 pb-4">
                    <div className="flex justify-between items-center">
                      <CardTitle className="font-display text-2xl">Day {day.day}</CardTitle>
                      <Badge variant={
                        day.energy_level === 'high' ? 'destructive' : 
                        day.energy_level === 'medium' ? 'default' : 'secondary'
                      }>
                        {day.energy_level} Energy
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-3 gap-6 pt-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-primary font-semibold">
                        <Coffee className="w-4 h-4" /> Morning
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{day.plan.morning}</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-accent font-semibold">
                        <Sun className="w-4 h-4" /> Afternoon
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{day.plan.afternoon}</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-indigo-500 font-semibold">
                        <Moon className="w-4 h-4" /> Evening
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{day.plan.evening}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </TabsContent>

          <TabsContent value="packing">
            <Card>
              <CardHeader>
                <CardTitle>Essential Packing List</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">👕</span>
                      Clothes
                    </h3>
                    <ul className="space-y-2">
                      <li className="flex justify-between text-sm border-b border-dashed pb-1">
                        <span>Tops</span>
                        <span className="font-mono font-bold text-primary">{trip.packing_list.clothes.tops}</span>
                      </li>
                      <li className="flex justify-between text-sm border-b border-dashed pb-1">
                        <span>Bottoms</span>
                        <span className="font-mono font-bold text-primary">{trip.packing_list.clothes.bottoms}</span>
                      </li>
                      <li className="flex justify-between text-sm border-b border-dashed pb-1">
                        <span>Outerwear</span>
                        <span className="font-mono font-bold text-primary">{trip.packing_list.clothes.outerwear}</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">👟</span>
                      Shoes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {trip.packing_list.shoes.map((item, i) => (
                        <Badge key={i} variant="secondary">{item}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">👓</span>
                      Accessories
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {trip.packing_list.accessories.map((item, i) => (
                        <Badge key={i} variant="outline">{item}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">🎒</span>
                      Misc
                    </h3>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {trip.packing_list.misc.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs">
            <Card>
              <CardHeader>
                <CardTitle>Required Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {trip.documents.map((doc, i) => (
                    <div key={i} className="flex items-center p-4 bg-muted/30 rounded-lg border">
                      <div className="p-2 bg-white rounded-md shadow-sm mr-4">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <span className="font-medium text-foreground">{doc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

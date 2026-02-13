import { Link } from "wouter";
import { MapPin } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg group-hover:scale-110 transition-transform duration-200">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-foreground">
              Travel<span className="text-primary">Taste</span>
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">How it works</a>
            <a href="#" className="hover:text-primary transition-colors">Examples</a>
            <a href="#" className="hover:text-primary transition-colors">About</a>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        {children}
      </main>

      <footer className="border-t py-12 bg-white/50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Travel Taste Matcher. AI-Powered Itineraries.</p>
        </div>
      </footer>
    </div>
  );
}

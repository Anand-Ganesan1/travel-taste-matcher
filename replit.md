# Travel Taste Matcher

## Overview

Travel Taste Matcher is a single-user, stateless MVP web application that generates personalized travel itineraries using AI. Users complete a multi-step questionnaire about their travel personality, mood, budget, and constraints. The app then calls OpenAI to generate a themed itinerary including destination suggestions, day-wise plans, packing lists, and travel document reminders.

There is no authentication, no payments, no booking functionality, and no persistent user data. Trip results are stored in `sessionStorage` for navigation between pages.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter (lightweight client-side router) with two main pages: Home (questionnaire wizard) and Results (itinerary display)
- **Styling**: Tailwind CSS with a custom travel-inspired color palette (ocean teal primary, sunset coral accent, soft sand secondary). Uses CSS variables for theming
- **UI Components**: shadcn/ui component library (new-york style) built on Radix UI primitives. Components live in `client/src/components/ui/`
- **Animations**: Framer Motion for page transitions and wizard step animations
- **State Management**: React Query (`@tanstack/react-query`) for server state; React Hook Form with Zod validation for the multi-step form
- **Fonts**: Outfit (display) and DM Sans (body), loaded via CSS variables `--font-display` and `--font-body`

### Backend
- **Framework**: Express 5 on Node.js with TypeScript (compiled via tsx in dev, esbuild for production)
- **API**: Single REST endpoint `POST /api/generate-itinerary` that accepts questionnaire data and returns an AI-generated trip plan
- **AI Integration**: OpenAI API accessed through Replit AI Integrations environment variables (`AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL`)
- **Storage**: In-memory only (no database needed for core functionality). The `MemStorage` class in `server/storage.ts` is a placeholder

### Database
- **ORM**: Drizzle ORM is configured with PostgreSQL dialect (`drizzle.config.ts`, `server/db.ts`)
- **Schema**: Defined in `shared/schema.ts` — currently contains only Zod schemas for request/response validation, not actual database tables for the core app
- **Chat models**: `shared/models/chat.ts` defines `conversations` and `messages` tables used by Replit integration modules (not the core travel app)
- **Migration**: Use `npm run db:push` (drizzle-kit push) to sync schema to database
- **Important**: The core travel app is stateless and doesn't use the database. The database exists for Replit integration features (chat storage). If extending the app with persistence, add tables to `shared/schema.ts`

### Shared Code
- `shared/schema.ts` — Zod schemas for trip request/response validation, shared between client and server
- `shared/routes.ts` — API route definitions with path, method, input/output schemas (typed API contract)
- Path aliases: `@/` → `client/src/`, `@shared/` → `shared/`

### Build & Dev
- **Dev**: `npm run dev` — runs tsx with Vite dev server middleware (HMR enabled)
- **Build**: `npm run build` — Vite builds the client to `dist/public/`, esbuild bundles the server to `dist/index.cjs`
- **Production**: `npm start` — serves the built client as static files from Express

### Multi-Step Wizard Architecture
The Home page implements a 3-step wizard:
1. **Basics** — Location, dates, budget, companions
2. **Travel Vibe** — Energy, activity, social, aesthetic sliders + personality traits
3. **Finishing Touches** — Themes, food preferences, weather preferences

Form state is managed by React Hook Form across all steps, validated with the shared Zod schema before submission.

### Replit Integration Modules
The `server/replit_integrations/` and `client/replit_integrations/` directories contain pre-built modules for:
- **Chat**: Conversation/message CRUD with database storage
- **Audio**: Voice recording, playback, and streaming (WebRTC + AudioWorklet)
- **Image**: Image generation via OpenAI's gpt-image-1 model
- **Batch**: Batch processing utilities with rate limiting and retries

These are available but not actively used by the core travel app.

## External Dependencies

### APIs & Services
- **OpenAI API** (via Replit AI Integrations): Used for generating travel itineraries. Configured through `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables
- **PostgreSQL Database**: Connected via `DATABASE_URL` environment variable. Used by Drizzle ORM for the chat integration module. The core app is stateless

### Key npm Packages
- **Frontend**: React, Wouter, @tanstack/react-query, react-hook-form, framer-motion, shadcn/ui (Radix UI primitives), Tailwind CSS, Zod, date-fns
- **Backend**: Express 5, OpenAI SDK, Drizzle ORM, drizzle-zod, connect-pg-simple, pg
- **Build**: Vite, esbuild, tsx, TypeScript
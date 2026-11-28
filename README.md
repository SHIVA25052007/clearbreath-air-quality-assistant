# ClearBreath — Urban Air Quality & Winter Smog Assistant

ClearBreath is a full-stack GenAI-powered assistant designed to help families and communities navigate severe winter smog and urban air pollution. It pairs location-based atmospheric telemetry (live Open-Meteo feeds alongside clearly labeled sample city presets) with a modeled household exposure & emissions simulator and tailored Gemini AI guidance.

## Features

- **Location & Winter Inversion Telemetry**: Search any global city via Open-Meteo Geocoding & Air Quality APIs (or inspect clearly labeled sample winter-smog reference cities) to view US AQI, PM2.5, PM10, NO₂, wind speed, winter inversion risk, a 24-hour hourly PM2.5 curve highlighting the safest 2-hour cross-ventilation window, and a lazy-loaded interactive 7-day D3 pollution pattern chart (`src/components/WeeklyTrendChart.tsx`). When an upstream feed omits secondary fields or historical points, those fields are explicitly flagged in the UI as estimated fallbacks rather than live sensor readings.
- **Household & Lifestyle Tailoring**: Customize home enclosure tightness, cooking fuel, daily commute mode/distance, filtration setup, and family sensitivities (infants, seniors, asthma/respiratory).
- **Modeled Household Impact Simulator**: Toggle low-emission daily routines, indoor air quality hacks (including DIY Corsi-Rosenthal MERV-13 filter cubes), and sustainable swaps to estimate daily inhaled PM2.5 dose reduction (µg/day), indoor PM2.5 drop (µg/m³), cigarette-equivalent exposure avoided, and weekly/seasonal CO₂e & particulate emissions avoided.
- **GenAI Tailored Action Plan & Advisor (`@google/genai`)**: Lazy-loaded panel backed by server-side `gemini-4-hydrogen` calls generates structured routines, indoor hacks, sustainable swaps, and answers multi-turn follow-up questions grounded in your location’s air quality, household profile, and direct impact numbers.
- **Neighborhood & School Air Bulletin**: Generates a copy-ready community notice summarizing today’s safest airing hours and modeled household emission savings, clearly marking whether metrics are from live observations or sample preset data.

## Architecture, Security & Accessibility

- **Modular Express Backend (`server.ts`, `src/server/`)**: Dedicated modules handle HTTP routes (`src/server/routes/`), Gemini AI invocation & prompt schemas (`src/server/services/geminiService.ts`, `src/server/services/geminiPrompts.ts`), Open-Meteo lookups & response normalization (`src/server/services/airQualityService.ts`, `src/server/services/openMeteoMapper.ts`), security headers & proxy-aware sliding-window rate limiting (`src/server/middleware/`), error masking (`src/server/middleware/errorHandler.ts`), and shared constants (`src/server/constants.ts`).
- **Production Mode & Security Hardening**:
  - `npm start` runs `NODE_ENV=production node server.ts` serving the compiled `dist/` bundle directly (never the Vite dev server).
  - HTTP security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Resource-Policy`, and strict production `Content-Security-Policy`) are enforced by `src/server/middleware/securityHeaders.ts`, with `X-Powered-By` disabled and `trust proxy` configured for proxy IP rate limiting.
  - Both `/api/assistant/*` and `/api/air-quality` routes enforce bounded sliding-window IP rate limits (`src/utils/rateLimiter.ts`), and Open-Meteo geocoding & telemetry responses share bounded TTL caches (`src/utils/cache.ts`).
  - `GEMINI_API_KEY` stays strictly server-side (`process.env.GEMINI_API_KEY`). Untrusted profile, location, and chat values are validated (`src/utils/validation.ts`), stripped of control/delimiter characters, and isolated inside `<household_telemetry_context>` and `<user_question>` boundaries with structured response validation.
- **Frontend Performance & WCAG 2.2 AA Accessibility**:
  - Below-the-fold sections and the D3 weekly trend chart are code-split via `React.lazy`, heavy sections are memoized, D3 imports are tree-shaken (`d3-array`, `d3-scale`, `d3-shape`), telemetry requests deduplicate and cancel in-flight requests via `AbortController` + bounded client cache, and editorial assets are compressed (`896x500` progressive JPEGs).
  - Keyboard navigation (skip link, `ArrowLeft`/`ArrowRight`/`Home`/`End` tablists, focusable SVG bars/data points with visible focus indicators), `role="status"`/`aria-live="polite"` loading, error, and clipboard announcements, >=12px readable typography, AA contrast, and `prefers-reduced-motion` support.
- **Unit & Integration Tests (`src/utils/*.test.ts`, `src/server/*.test.ts`)**: Tested with `node:test`, including mocked Open-Meteo and mocked Gemini service behavior, proxy rate limiting, validation edge cases, trend statistics, and exposure/emissions calculations.

## Running Locally

```bash
npm install
cp .env.example .env
# Add your GEMINI_API_KEY to .env
npm run dev
```

For production builds:

```bash
npm run build
npm start
```

## Verification & Testing

```bash
npm test
npm run lint
npm run build
```

## Chosen Vertical
Urban Air Quality Assistant (Challenge 6).

## Approach and Logic
- Uses the selected city's air quality and weather data.
- Considers household details such as home type, cooking fuel, commute, air filtration and health sensitivities.
- Finds a lower-PM2.5 2-hour window for airing the home from the hourly forecast.
- Estimates the impact of the user's selected choices.
- Sends this context to Gemini to generate tailored advice.

## How the Solution Works
1. Search for a city or pick a preset.
2. Enter household and lifestyle details.
3. Select choices in the Impact Simulator.
4. Generate an AI action plan or ask the advisor a question.

## Assumptions and Limitations
- Live data comes from Open-Meteo and may be cached or differ from conditions at your home.
- Preset reference values are not live readings.
- Some missing values may be filled with defaults or estimates.
- Exposure and emissions figures are estimates, not measurements.
- AI advice can be wrong and is not medical advice.
- AI features require a Gemini API key on the server.

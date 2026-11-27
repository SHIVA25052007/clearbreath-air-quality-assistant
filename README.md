# ClearBreath — Urban Air Quality & Winter Smog Assistant

ClearBreath is a full-stack GenAI-powered assistant designed to help families and communities navigate severe winter smog and urban air pollution. It pairs live location-based atmospheric telemetry with a physics-grounded household impact simulator and tailored Gemini AI guidance.

## Features

- **Location & Winter Inversion Telemetry**: Search any global city via Open-Meteo Geocoding & Air Quality APIs (with instant winter-smog city presets) to inspect US AQI, PM2.5, PM10, NO₂, wind speed, winter inversion risk, and a 24-hour hourly PM2.5 curve highlighting the safest 2-hour cross-ventilation window.
- **Household & Lifestyle Tailoring**: Customize home enclosure tightness, cooking fuel, daily commute mode/distance, filtration setup, and family sensitivities (infants, seniors, asthma/respiratory).
- **Direct Impact Simulator**: Toggle low-emission daily routines, indoor air quality hacks (including DIY Corsi-Rosenthal MERV-13 filter cubes), and sustainable swaps to immediately quantify daily inhaled PM2.5 dose reduction (µg/day), indoor PM2.5 drop (µg/m³), cigarette-equivalent exposure avoided, and weekly/seasonal CO₂e & particulate emissions avoided.
- **GenAI Tailored Action Plan & Advisor (`@google/genai`)**: Server-side `gemini-4-hydrogen` integration generates structured routines, indoor hacks, sustainable swaps, and answers multi-turn follow-up questions grounded in your city’s live air quality and household profile.
- **Neighborhood & School Air Bulletin**: Generates a copy-ready community notice summarizing today’s safest airing hours and collective emission reductions.

## Architecture & Security

- **Server-Side AI & API Proxy (`server.ts`)**: All `@google/genai` calls run strictly on the Express backend using `process.env.GEMINI_API_KEY`. Upstream weather/air quality lookups are validated and restricted to allowlisted Open-Meteo endpoints with 5-minute TTL caching.
- **Input Validation (`src/utils/validation.ts`)**: Shared sanitization and coordinate/query bounds checks across client and server.
- **Pure Logic & Unit Tests (`src/utils/*.test.ts`)**: Air quality categorization, ventilation window discovery, exposure/emissions math, and validation are decoupled from React UI and tested with `node:test`.

## Running Locally

```bash
npm install
cp .env.example .env
# Add your GEMINI_API_KEY to .env
npm run dev
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

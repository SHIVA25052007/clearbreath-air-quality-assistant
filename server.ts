import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AiActionPlan,
  HouseholdProfile,
  HourlyForecastPoint,
  ImpactSummary,
  LocationTelemetry,
} from './src/types/airQuality.ts';
import {
  aggregateDailyTrend,
  computeWinterInversionRisk,
  estimateUsAqiFromPm25,
  findCleanestVentilationWindow,
} from './src/utils/airQuality.ts';
import { BoundedTtlCache } from './src/utils/cache.ts';
import { createRateLimiter } from './src/utils/rateLimiter.ts';
import {
  sanitizeTextInput,
  validateAssistantChatRequest,
  validateAssistantPlanRequest,
  validateCityQuery,
  validateCoordinates,
} from './src/utils/validation.ts';

const PORT = Number(process.env.PORT) || 3000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;
const AI_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const AI_RATE_LIMIT_MAX_REQUESTS = 15;

const airQualityCache = new BoundedTtlCache<LocationTelemetry>({
  maxEntries: CACHE_MAX_ENTRIES,
  ttlMs: CACHE_TTL_MS,
});

const cacheCleanupTimer = setInterval(() => {
  airQualityCache.pruneExpired();
}, CACHE_TTL_MS);
cacheCleanupTimer.unref();

const aiRateLimiter = createRateLimiter({
  windowMs: AI_RATE_LIMIT_WINDOW_MS,
  maxRequests: AI_RATE_LIMIT_MAX_REQUESTS,
  maxTrackedKeys: 2000,
});

function enforceAiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
  const result = aiRateLimiter.check(clientKey);
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSec));
    res.status(429).json({
      error: `Too many AI requests. Please wait ${result.retryAfterSec} seconds before trying again.`,
    });
    return;
  }
  next();
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : 0;
      const retryable = status === 429 || status === 503 || status === 502;
      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: unknown }).status)
      : 500;

  if (status === 400 || rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message: 'The AI service rejected the request or API key. Check Settings > Secrets.',
    };
  }
  if (status === 403 || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'Permission denied by the AI service. Verify your API key in Settings > Secrets.',
    };
  }
  if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'AI rate limit reached. Wait a few seconds and try again.',
    };
  }
  if (status === 404 || rawMessage.includes('NOT_FOUND')) {
    return {
      status: 502,
      message: 'Configured Gemini model was unavailable.',
    };
  }
  return {
    status: 502,
    message: 'Unable to reach the Gemini AI service right now. Please retry shortly.',
  };
}

async function fetchOpenMeteoTelemetry(
  city: string,
  region: string,
  country: string,
  lat: number,
  lon: number
): Promise<LocationTelemetry> {
  const aqUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  aqUrl.searchParams.set('latitude', String(lat));
  aqUrl.searchParams.set('longitude', String(lon));
  aqUrl.searchParams.set(
    'current',
    'us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone'
  );
  aqUrl.searchParams.set('hourly', 'pm10,pm2_5,us_aqi');
  aqUrl.searchParams.set('past_days', '6');
  aqUrl.searchParams.set('forecast_days', '2');
  aqUrl.searchParams.set('timezone', 'auto');

  const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
  weatherUrl.searchParams.set('latitude', String(lat));
  weatherUrl.searchParams.set('longitude', String(lon));
  weatherUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,wind_speed_10m');
  weatherUrl.searchParams.set('hourly', 'temperature_2m,wind_speed_10m');
  weatherUrl.searchParams.set('forecast_days', '2');
  weatherUrl.searchParams.set('timezone', 'auto');

  const [aqRes, weatherRes] = await Promise.all([
    fetch(aqUrl, { signal: AbortSignal.timeout(6000) }),
    fetch(weatherUrl, { signal: AbortSignal.timeout(6000) }),
  ]);

  if (!aqRes.ok || !weatherRes.ok) {
    throw new Error(`Upstream air quality API error (${aqRes.status}/${weatherRes.status})`);
  }

  const aqData = (await aqRes.json()) as {
    timezone?: string;
    current?: {
      time?: string;
      us_aqi?: number;
      european_aqi?: number;
      pm10?: number;
      pm2_5?: number;
      carbon_monoxide?: number;
      nitrogen_dioxide?: number;
      sulphur_dioxide?: number;
      ozone?: number;
    };
    hourly?: {
      time?: string[];
      pm2_5?: Array<number | null>;
      pm10?: Array<number | null>;
      us_aqi?: Array<number | null>;
    };
  };

  const weatherData = (await weatherRes.json()) as {
    current?: {
      temperature_2m?: number;
      relative_humidity_2m?: number;
      wind_speed_10m?: number;
    };
    hourly?: {
      time?: string[];
      temperature_2m?: Array<number | null>;
      wind_speed_10m?: Array<number | null>;
    };
  };

  const currentAq = aqData.current ?? {};
  const currentWeather = weatherData.current ?? {};
  const pm25 = Math.round((currentAq.pm2_5 ?? 18) * 10) / 10;
  const pm10 = Math.round((currentAq.pm10 ?? pm25 * 1.5) * 10) / 10;
  const usAqi = Math.round(currentAq.us_aqi ?? estimateUsAqiFromPm25(pm25));
  const tempC = Math.round((currentWeather.temperature_2m ?? 10) * 10) / 10;
  const windKmh = Math.round((currentWeather.wind_speed_10m ?? 6) * 10) / 10;

  const times = aqData.hourly?.time ?? [];
  const hourlyPm25 = aqData.hourly?.pm2_5 ?? [];
  const hourlyPm10 = aqData.hourly?.pm10 ?? [];
  const hourlyAqi = aqData.hourly?.us_aqi ?? [];
  const weatherTimes = weatherData.hourly?.time ?? [];
  const hourlyWind = weatherData.hourly?.wind_speed_10m ?? [];
  const hourlyTemp = weatherData.hourly?.temperature_2m ?? [];

  const weatherByTime = new Map<string, { wind: number; temp: number }>();
  for (let i = 0; i < weatherTimes.length; i++) {
    weatherByTime.set(weatherTimes[i], {
      wind: Math.round((hourlyWind[i] ?? windKmh) * 10) / 10,
      temp: Math.round((hourlyTemp[i] ?? tempC) * 10) / 10,
    });
  }

  const nowMs = Date.now();
  let startIdx = times.findIndex((t) => new Date(t).getTime() >= nowMs - 3600 * 1000);
  if (startIdx < 0) startIdx = Math.max(0, times.length - 24);

  const hourly: HourlyForecastPoint[] = [];
  for (let i = startIdx; i < Math.min(times.length, startIdx + 24); i++) {
    const timeIso = times[i];
    const hourPart = timeIso.split('T')[1]?.slice(0, 5) ?? `${String(i % 24).padStart(2, '0')}:00`;
    const ptPm25 = Math.round((hourlyPm25[i] ?? pm25) * 10) / 10;
    const ptPm10 = Math.round((hourlyPm10[i] ?? pm10) * 10) / 10;
    const ptAqi = Math.round(hourlyAqi[i] ?? estimateUsAqiFromPm25(ptPm25));
    const matchedWeather = weatherByTime.get(timeIso);
    hourly.push({
      timeIso,
      hourLabel: hourPart,
      pm25: ptPm25,
      pm10: ptPm10,
      usAqi: ptAqi,
      windKmh: matchedWeather?.wind ?? windKmh,
      tempC: matchedWeather?.temp ?? tempC,
    });
  }

  // Aggregate up through today (exclude tomorrow's forecast hours from the 7-day trend)
  const todayDateStr = (currentAq.time ?? new Date().toISOString()).slice(0, 10);
  let historicalEndIdx = -1;
  for (let i = times.length - 1; i >= 0; i--) {
    if (times[i].slice(0, 10) <= todayDateStr) {
      historicalEndIdx = i;
      break;
    }
  }
  const trendSliceEnd = historicalEndIdx >= 0 ? historicalEndIdx + 1 : times.length;
  const weeklyTrend = aggregateDailyTrend(
    times.slice(0, trendSliceEnd),
    hourlyPm25.slice(0, trendSliceEnd),
    hourlyAqi.slice(0, trendSliceEnd),
    pm25,
    7
  );

  return {
    city,
    region,
    country,
    latitude: lat,
    longitude: lon,
    timezone: aqData.timezone ?? 'UTC',
    observedAtIso: currentAq.time ?? new Date().toISOString(),
    usAqi,
    europeanAqi: Math.round(currentAq.european_aqi ?? usAqi * 0.55),
    pm25,
    pm10,
    no2: Math.round((currentAq.nitrogen_dioxide ?? 22) * 10) / 10,
    so2: Math.round((currentAq.sulphur_dioxide ?? 6) * 10) / 10,
    o3: Math.round((currentAq.ozone ?? 34) * 10) / 10,
    coUgM3: Math.round(currentAq.carbon_monoxide ?? 450),
    tempC,
    windKmh,
    humidityPct: Math.round(currentWeather.relative_humidity_2m ?? 65),
    inversionRisk: computeWinterInversionRisk(pm25, windKmh, tempC),
    hourly,
    weeklyTrend,
    dataSource: 'live',
  };
}

function buildLocationSummaryForPrompt(
  telemetry: LocationTelemetry,
  profile: HouseholdProfile,
  impact: ImpactSummary
): string {
  const vent = findCleanestVentilationWindow(telemetry.hourly);
  return [
    `Location: ${telemetry.city}, ${telemetry.region}, ${telemetry.country}`,
    `Current Air Quality: US AQI ${telemetry.usAqi}, PM2.5 ${telemetry.pm25} µg/m³, PM10 ${telemetry.pm10} µg/m³, NO2 ${telemetry.no2} µg/m³, O3 ${telemetry.o3} µg/m³`,
    `Meteorology: ${telemetry.tempC}°C, Wind ${telemetry.windKmh} km/h, Humidity ${telemetry.humidityPct}%, Winter Inversion Risk: ${telemetry.inversionRisk}`,
    `Cleanest 2h Ventilation Window (from 24h curve): ${vent.startLabel}–${vent.endLabel} (~${vent.avgPm25} µg/m³ PM2.5, US AQI ${vent.avgUsAqi})`,
    `Household Profile: ${profile.householdSize} people, sensitivities: ${profile.sensitivities.join(', ') || 'none specified'}, home type: ${profile.homeType}, cooking fuel: ${profile.cookingFuel}, commute: ${profile.commuteMode} (${profile.dailyCommuteKm} km/day), purifier setup: ${profile.purifierSetup}`,
    `Calculated Current Choices Impact: Indoor PM2.5 ${impact.baselineIndoorPm25} -> ${impact.mitigatedIndoorPm25} µg/m³ (-${impact.indoorReductionPct}%), Daily Inhaled Dose ${impact.baselineDailyDoseUg} -> ${impact.mitigatedDailyDoseUg} µg/day (-${impact.doseReductionPct}%), Weekly CO2e avoided: ${impact.weeklyCo2AvoidedKg} kg`,
  ].join('\n');
}

async function createServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    res.json({
      ok: true,
      aiConfigured: Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY'),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/air-quality', async (req: Request, res: Response) => {
    try {
      const hasCoords = req.query.lat !== undefined && req.query.lon !== undefined;

      if (hasCoords) {
        const coordCheck = validateCoordinates(req.query.lat, req.query.lon);
        if (!coordCheck.valid) {
          res.status(400).json({ error: coordCheck.error });
          return;
        }
        const city = sanitizeTextInput(req.query.name ?? 'Selected Location', 60) || 'Selected Location';
        const region = sanitizeTextInput(req.query.region ?? '', 60);
        const country = sanitizeTextInput(req.query.country ?? '', 60);
        const cacheKey = `${coordCheck.lat.toFixed(2)},${coordCheck.lon.toFixed(2)}`;
        const cached = airQualityCache.get(cacheKey);
        if (cached) {
          res.json({ telemetry: cached, cached: true });
          return;
        }

        const telemetry = await fetchOpenMeteoTelemetry(
          city,
          region,
          country,
          coordCheck.lat,
          coordCheck.lon
        );
        airQualityCache.set(cacheKey, telemetry);
        res.json({ telemetry, cached: false });
        return;
      }

      const cityCheck = validateCityQuery(req.query.city);
      if (!cityCheck.valid) {
        res.status(400).json({ error: cityCheck.error });
        return;
      }

      const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
      geoUrl.searchParams.set('name', cityCheck.city);
      geoUrl.searchParams.set('count', '1');
      geoUrl.searchParams.set('language', 'en');
      geoUrl.searchParams.set('format', 'json');

      const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(6000) });
      if (!geoRes.ok) {
        res.status(502).json({ error: 'Geocoding service temporarily unavailable.' });
        return;
      }
      const geoJson = (await geoRes.json()) as {
        results?: Array<{
          name: string;
          admin1?: string;
          country?: string;
          latitude: number;
          longitude: number;
        }>;
      };

      const match = geoJson.results?.[0];
      if (!match) {
        res.status(404).json({
          error: `No matching city found for "${cityCheck.city}". Try adding a country or checking spelling.`,
        });
        return;
      }

      const cacheKey = `${match.latitude.toFixed(2)},${match.longitude.toFixed(2)}`;
      const cached = airQualityCache.get(cacheKey);
      if (cached) {
        res.json({ telemetry: cached, cached: true });
        return;
      }

      const telemetry = await fetchOpenMeteoTelemetry(
        match.name,
        match.admin1 ?? '',
        match.country ?? '',
        match.latitude,
        match.longitude
      );
      airQualityCache.set(cacheKey, telemetry);
      res.json({ telemetry, cached: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to fetch live air quality data.';
      res.status(502).json({ error: msg });
    }
  });

  app.post('/api/assistant/plan', enforceAiRateLimit, async (req: Request, res: Response) => {
    try {
      const validated = validateAssistantPlanRequest(req.body);
      if (!validated.valid) {
        res.status(400).json({ error: validated.error });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to generate AI plans.',
        });
        return;
      }

      const contextPrompt = buildLocationSummaryForPrompt(
        validated.telemetry,
        validated.profile,
        validated.impact
      );

      const prompt = [
        'Generate a practical, empathetic, evidence-based winter smog survival and low-emission action plan for this family.',
        'Tailor every suggestion directly to their city telemetry, thermal inversion risk, home setup, cooking fuel, commute, and sensitivities.',
        'For every item, explicitly explain the direct health exposure impact AND/OR community emissions impact in concrete plain numbers.',
        validated.adoptedTitles.length > 0
          ? `Choices they have already selected in the Impact Lab: ${validated.adoptedTitles.join('; ')}`
          : 'They have not selected specific interventions yet—prioritize the highest-impact free and low-cost actions first.',
        '',
        contextPrompt,
      ].join('\n');

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction:
              'You are ClearBreath, an environmental health and urban air quality advisor helping families navigate severe winter smog. Be concise, practical, affordable, and transparent about the direct measurable impact of each choice. Never invent fake medical diagnoses.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: {
                  type: Type.STRING,
                  description: 'A crisp 1-sentence summary tailored to the city and household.',
                },
                smogRiskSummary: {
                  type: Type.STRING,
                  description: '2 sentences explaining why current smog/inversion conditions behave this way and who is most affected.',
                },
                cleanestVentilationWindow: {
                  type: Type.STRING,
                  description: 'Specific time window and guidance for airing out the home safely today.',
                },
                routines: {
                  type: Type.ARRAY,
                  description: '3 low-emission daily routine adjustments timed to the hourly smog curve.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      timingOrLocation: { type: Type.STRING },
                      actionSteps: { type: Type.STRING },
                      directImpact: { type: Type.STRING },
                    },
                    required: ['title', 'timingOrLocation', 'actionSteps', 'directImpact'],
                  },
                },
                indoorHacks: {
                  type: Type.ARRAY,
                  description: '3 affordable indoor air quality hacks tailored to home type, cooking fuel, and purifier status.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      timingOrLocation: { type: Type.STRING },
                      actionSteps: { type: Type.STRING },
                      directImpact: { type: Type.STRING },
                    },
                    required: ['title', 'timingOrLocation', 'actionSteps', 'directImpact'],
                  },
                },
                sustainableAlternatives: {
                  type: Type.ARRAY,
                  description: '3 community-minded sustainable swaps for transit, cooking, or heating.',
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      timingOrLocation: { type: Type.STRING },
                      actionSteps: { type: Type.STRING },
                      directImpact: { type: Type.STRING },
                    },
                    required: ['title', 'timingOrLocation', 'actionSteps', 'directImpact'],
                  },
                },
                communityNotice: {
                  type: Type.STRING,
                  description: 'A 3-4 sentence neighbor/school-group alert summarizing today’s safest hours and one collective low-emission action.',
                },
              },
              required: [
                'headline',
                'smogRiskSummary',
                'cleanestVentilationWindow',
                'routines',
                'indoorHacks',
                'sustainableAlternatives',
                'communityNotice',
              ],
            },
          },
        })
      );

      const rawText = (response.text ?? '{}').trim();
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        res.status(502).json({ error: 'Received an invalid plan format from the AI service.' });
        return;
      }

      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        res.status(502).json({ error: 'Received an unexpected plan payload from the AI service.' });
        return;
      }

      const plan: AiActionPlan = {
        ...(parsed as Omit<AiActionPlan, 'generatedAt' | 'model'>),
        generatedAt: new Date().toISOString(),
        model: 'gemini-4-hydrogen',
      };
      res.json({ plan });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/assistant/chat', enforceAiRateLimit, async (req: Request, res: Response) => {
    try {
      const validated = validateAssistantChatRequest(req.body);
      if (!validated.valid) {
        res.status(400).json({ error: validated.error });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to chat with the AI advisor.',
        });
        return;
      }

      const contextBlock = buildLocationSummaryForPrompt(
        validated.telemetry,
        validated.profile,
        validated.impact
      );

      const promptLines = [
        'LIVE HOUSEHOLD & CITY CONTEXT:',
        contextBlock,
        '',
        ...(validated.history.length > 0
          ? [
              'RECENT CONVERSATION:',
              ...validated.history.map((h) => `${h.role}: ${h.text}`),
              '',
            ]
          : []),
        `FAMILY QUESTION: ${validated.message}`,
      ].join('\n');

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: promptLines,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction:
              'You are ClearBreath, an AI urban air quality advisor. Answer in 2-4 crisp, well-structured short paragraphs or bullet points (under 180 words total). Always tie advice to the family’s actual PM2.5, AQI, cleanest ventilation window, and household setup, and clearly state the direct health or emission impact of the recommended choice.',
          },
        })
      );

      const reply = (response.text ?? '').trim();
      if (!reply) {
        res.status(502).json({ error: 'Received an empty response from the AI advisor.' });
        return;
      }
      res.json({ reply });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const isJsonSyntaxError =
      err instanceof SyntaxError &&
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      (err as { status?: number }).status === 400;

    if (isJsonSyntaxError) {
      res.status(400).json({ error: 'Invalid JSON request body.' });
      return;
    }
    res.status(500).json({ error: 'Unexpected server error. Please try again.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClearBreath server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start ClearBreath server:', err);
  process.exit(1);
});

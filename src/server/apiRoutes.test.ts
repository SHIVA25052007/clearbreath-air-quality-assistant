import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { PRESET_CITIES } from '../data/presetCities.ts';
import { calculateHouseholdImpact, DEFAULT_HOUSEHOLD_PROFILE } from '../utils/impactCalculator.ts';
import { createApiApp } from './app.ts';
import { createAiRateLimitMiddleware, createRateLimitMiddleware } from './middleware/rateLimit.ts';
import { type AirQualityService } from './services/airQualityService.ts';
import { mapOpenMeteoToTelemetry } from './services/openMeteoMapper.ts';

const sampleTelemetry = PRESET_CITIES[0];
const sampleProfile = DEFAULT_HOUSEHOLD_PROFILE;
const sampleImpact = calculateHouseholdImpact(sampleTelemetry, sampleProfile, [
  'routine_afternoon_airing',
]);

async function withApiServer(
  options: Parameters<typeof createApiApp>[0],
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = createApiApp(options);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    options.airQualityService.stopCleanup();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test('mapOpenMeteoToTelemetry derives PM2.5 fallback from PM10 and tracks estimatedFields', () => {
  const times = Array.from({ length: 24 }, (_, idx) => `2026-11-28T${String(idx).padStart(2, '0')}:00`);
  const mapped = mapOpenMeteoToTelemetry({
    city: 'Krakow',
    region: 'Lesser Poland',
    country: 'Poland',
    latitude: 50.06,
    longitude: 19.94,
    nowMs: new Date('2026-11-28T06:00:00Z').getTime(),
    aqData: {
      timezone: 'Europe/Warsaw',
      current: {
        time: '2026-11-28T06:00',
        pm2_5: null,
        pm10: 100,
        us_aqi: null,
        nitrogen_dioxide: null,
      },
      hourly: {
        time: times,
        pm2_5: times.map(() => 65),
        pm10: times.map(() => 100),
      },
    },
    weatherData: {
      current: {
        temperature_2m: 2,
        relative_humidity_2m: 82,
        wind_speed_10m: 3.1,
      },
      hourly: {
        time: times,
        temperature_2m: times.map(() => 2),
        wind_speed_10m: times.map(() => 3.1),
      },
    },
  });

  assert.equal(mapped.pm25, 65);
  assert.equal(mapped.pm10, 100);
  assert.ok(mapped.usAqi >= 150);
  assert.ok(mapped.estimatedFields?.includes('PM2.5'));
  assert.ok(mapped.estimatedFields?.includes('US AQI'));
  assert.ok(mapped.estimatedFields?.includes('NO2'));
});

test('GET /api/air-quality supports coordinate lookups, sanitizes place labels, and rejects missing params', async () => {
  let receivedCoordParams: Parameters<AirQualityService['getByCoordinates']>[0] | null = null;
  const stubService: AirQualityService = {
    async getByCoordinates(params) {
      receivedCoordParams = params;
      return {
        telemetry: { ...sampleTelemetry, ...params },
        cached: false,
      };
    },
    async getByCityName() {
      return { telemetry: sampleTelemetry, cached: true };
    },
    stopCleanup() {},
  };

  await withApiServer(
    {
      airQualityService: stubService,
      isProduction: false,
    },
    async (baseUrl) => {
      // Development mode omits production CSP while keeping baseline security headers
      const healthRes = await fetch(`${baseUrl}/api/health`);
      assert.equal(healthRes.status, 200);
      assert.equal(healthRes.headers.get('content-security-policy'), null);
      assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');

      // Missing both query parameters -> 400
      const emptyQueryRes = await fetch(`${baseUrl}/api/air-quality`);
      assert.equal(emptyQueryRes.status, 400);

      // Missing lat when lon provided -> 400
      const lonOnlyRes = await fetch(`${baseUrl}/api/air-quality?lon=77.2`);
      assert.equal(lonOnlyRes.status, 400);

      // Valid coordinate lookup sanitizes name/region/country
      const coordRes = await fetch(
        `${baseUrl}/api/air-quality?lat=31.55&lon=74.34&name=Lahore%07&region=Punjab&country=Pakistan`
      );
      assert.equal(coordRes.status, 200);
      const coordBody = (await coordRes.json()) as {
        telemetry: { city: string; latitude: number; longitude: number };
        cached: boolean;
      };
      assert.equal(coordBody.telemetry.city, 'Lahore');
      assert.equal(coordBody.telemetry.latitude, 31.55);
      assert.equal(coordBody.cached, false);
      assert.ok(receivedCoordParams);
      assert.equal(receivedCoordParams.region, 'Punjab');
      assert.equal(receivedCoordParams.country, 'Pakistan');

      // Unmatched API endpoint returns JSON 404
      const unknownApiRes = await fetch(`${baseUrl}/api/unknown-endpoint`);
      assert.equal(unknownApiRes.status, 404);
      const unknownJson = (await unknownApiRes.json()) as { error: string };
      assert.equal(unknownJson.error, 'API endpoint not found.');
    }
  );
});

test('POST /api/assistant/* enforces 64kb payload limit, handles service errors, and catches thrown errors cleanly', async () => {
  const stubService: AirQualityService = {
    async getByCoordinates() {
      return { telemetry: sampleTelemetry, cached: false };
    },
    async getByCityName() {
      return { telemetry: sampleTelemetry, cached: false };
    },
    stopCleanup() {},
  };

  await withApiServer(
    {
      airQualityService: stubService,
      rateLimitMiddleware: createAiRateLimitMiddleware({
        windowMs: 60_000,
        maxRequests: 10,
      }),
      airQualityRateLimitMiddleware: createRateLimitMiddleware({
        windowMs: 60_000,
        maxRequests: 10,
      }),
      async generateActionPlan() {
        return {
          ok: false,
          status: 503,
          error: 'Gemini API key is not configured on the server.',
        };
      },
      async askAdvisor() {
        throw new Error('Unhandled unexpected failure with internal trace');
      },
    },
    async (baseUrl) => {
      // Service-level 503 status and message propagate cleanly for /plan
      const plan503Res = await fetch(`${baseUrl}/api/assistant/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetry: sampleTelemetry,
          profile: sampleProfile,
          impact: sampleImpact,
          adoptedTitles: [],
        }),
      });
      assert.equal(plan503Res.status, 503);
      const plan503Json = (await plan503Res.json()) as { error: string };
      assert.ok(plan503Json.error.includes('Gemini API key'));

      // Unexpected thrown exception in /chat is forwarded via next(err) to apiErrorHandler (500 masked)
      const chat500Res = await fetch(`${baseUrl}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'How long should we run the purifier?',
          telemetry: sampleTelemetry,
          profile: sampleProfile,
          impact: sampleImpact,
        }),
      });
      assert.equal(chat500Res.status, 500);
      const chat500Json = (await chat500Res.json()) as { error: string };
      assert.equal(chat500Json.error, 'Unexpected server error. Please try again.');

      // Oversized >64kb JSON body returns HTTP 413
      const oversizedPayload = JSON.stringify({
        message: 'A'.repeat(75_000),
      });
      const res413 = await fetch(`${baseUrl}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: oversizedPayload,
      });
      assert.equal(res413.status, 413);
      const json413 = (await res413.json()) as { error: string };
      assert.equal(json413.error, 'Request payload is too large.');
    }
  );
});

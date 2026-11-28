import type { LocationTelemetry } from '../../types/airQuality.ts';
import { BoundedTtlCache } from '../../utils/cache.ts';
import {
  AIR_QUALITY_CACHE_MAX_ENTRIES,
  AIR_QUALITY_CACHE_TTL_MS,
  FORECAST_DAYS,
  GEOCODE_CACHE_MAX_ENTRIES,
  GEOCODE_CACHE_TTL_MS,
  OPEN_METEO_AIR_QUALITY_URL,
  OPEN_METEO_GEOCODING_URL,
  OPEN_METEO_WEATHER_URL,
  TREND_LOOKBACK_DAYS,
  UPSTREAM_TIMEOUT_MS,
} from '../constants.ts';
import {
  mapOpenMeteoToTelemetry,
  UpstreamServiceError,
  type OpenMeteoAirQualityResponse,
  type OpenMeteoGeocodingMatch,
  type OpenMeteoGeocodingResponse,
  type OpenMeteoWeatherResponse,
} from './openMeteoMapper.ts';

export { UpstreamServiceError };

export interface TelemetryLookupResult {
  telemetry: LocationTelemetry;
  cached: boolean;
}

export interface AirQualityService {
  getByCoordinates: (params: {
    city: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  }) => Promise<TelemetryLookupResult>;
  getByCityName: (cityQuery: string) => Promise<TelemetryLookupResult | null>;
  stopCleanup: () => void;
}

export interface AirQualityServiceOptions {
  fetchImpl?: typeof fetch;
}

function buildCoordinateCacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

async function fetchOpenMeteoTelemetry(
  fetchImpl: typeof fetch,
  city: string,
  region: string,
  country: string,
  latitude: number,
  longitude: number
): Promise<LocationTelemetry> {
  const aqUrl = new URL(OPEN_METEO_AIR_QUALITY_URL);
  aqUrl.searchParams.set('latitude', String(latitude));
  aqUrl.searchParams.set('longitude', String(longitude));
  aqUrl.searchParams.set(
    'current',
    'us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone'
  );
  aqUrl.searchParams.set('hourly', 'pm10,pm2_5,us_aqi');
  aqUrl.searchParams.set('past_days', String(TREND_LOOKBACK_DAYS));
  aqUrl.searchParams.set('forecast_days', String(FORECAST_DAYS));
  aqUrl.searchParams.set('timezone', 'auto');

  const weatherUrl = new URL(OPEN_METEO_WEATHER_URL);
  weatherUrl.searchParams.set('latitude', String(latitude));
  weatherUrl.searchParams.set('longitude', String(longitude));
  weatherUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,wind_speed_10m');
  weatherUrl.searchParams.set('hourly', 'temperature_2m,wind_speed_10m');
  weatherUrl.searchParams.set('forecast_days', String(FORECAST_DAYS));
  weatherUrl.searchParams.set('timezone', 'auto');

  const [aqRes, weatherRes] = await Promise.all([
    fetchImpl(aqUrl, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) }),
    fetchImpl(weatherUrl, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) }),
  ]);

  if (!aqRes.ok || !weatherRes.ok) {
    throw new UpstreamServiceError(
      `Upstream air quality API error (${aqRes.status}/${weatherRes.status})`,
      502
    );
  }

  const aqData = (await aqRes.json()) as OpenMeteoAirQualityResponse;
  const weatherData = (await weatherRes.json()) as OpenMeteoWeatherResponse;

  return mapOpenMeteoToTelemetry({
    city,
    region,
    country,
    latitude,
    longitude,
    aqData,
    weatherData,
  });
}

async function geocodeCity(
  fetchImpl: typeof fetch,
  cityQuery: string
): Promise<OpenMeteoGeocodingMatch | null> {
  const geoUrl = new URL(OPEN_METEO_GEOCODING_URL);
  geoUrl.searchParams.set('name', cityQuery);
  geoUrl.searchParams.set('count', '1');
  geoUrl.searchParams.set('language', 'en');
  geoUrl.searchParams.set('format', 'json');

  const geoRes = await fetchImpl(geoUrl, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  if (!geoRes.ok) {
    throw new UpstreamServiceError('Geocoding service temporarily unavailable.', 502);
  }

  const geoJson = (await geoRes.json()) as OpenMeteoGeocodingResponse;
  return geoJson.results?.[0] ?? null;
}

export function createAirQualityService(
  options: AirQualityServiceOptions = {}
): AirQualityService {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  const telemetryCache = new BoundedTtlCache<LocationTelemetry>({
    maxEntries: AIR_QUALITY_CACHE_MAX_ENTRIES,
    ttlMs: AIR_QUALITY_CACHE_TTL_MS,
  });

  const geocodeCache = new BoundedTtlCache<{ match: OpenMeteoGeocodingMatch | null }>({
    maxEntries: GEOCODE_CACHE_MAX_ENTRIES,
    ttlMs: GEOCODE_CACHE_TTL_MS,
  });

  const cleanupTimer = setInterval(() => {
    telemetryCache.pruneExpired();
    geocodeCache.pruneExpired();
  }, AIR_QUALITY_CACHE_TTL_MS);
  cleanupTimer.unref();

  async function resolveWithCache(params: {
    city: string;
    region: string;
    country: string;
    latitude: number;
    longitude: number;
  }): Promise<TelemetryLookupResult> {
    const cacheKey = buildCoordinateCacheKey(params.latitude, params.longitude);
    const cached = telemetryCache.get(cacheKey);
    if (cached) {
      return { telemetry: cached, cached: true };
    }

    const telemetry = await fetchOpenMeteoTelemetry(
      fetchImpl,
      params.city,
      params.region,
      params.country,
      params.latitude,
      params.longitude
    );
    telemetryCache.set(cacheKey, telemetry);
    return { telemetry, cached: false };
  }

  return {
    getByCoordinates: resolveWithCache,
    async getByCityName(cityQuery: string): Promise<TelemetryLookupResult | null> {
      const normalizedQuery = cityQuery.trim().toLowerCase();
      const cachedGeo = geocodeCache.get(normalizedQuery);
      const match = cachedGeo ? cachedGeo.match : await geocodeCity(fetchImpl, cityQuery);
      if (!cachedGeo) {
        geocodeCache.set(normalizedQuery, { match });
      }
      if (!match) {
        return null;
      }
      return resolveWithCache({
        city: match.name,
        region: match.admin1 ?? '',
        country: match.country ?? '',
        latitude: match.latitude,
        longitude: match.longitude,
      });
    },
    stopCleanup(): void {
      clearInterval(cleanupTimer);
    },
  };
}

export const DEFAULT_PORT = 3000;
export const JSON_BODY_LIMIT = '64kb';

export const AIR_QUALITY_CACHE_TTL_MS = 5 * 60 * 1000;
export const AIR_QUALITY_CACHE_MAX_ENTRIES = 100;
export const GEOCODE_CACHE_TTL_MS = 15 * 60 * 1000;
export const GEOCODE_CACHE_MAX_ENTRIES = 200;

export const AI_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const AI_RATE_LIMIT_MAX_REQUESTS = 15;
export const AI_RATE_LIMIT_MAX_KEYS = 2000;

export const AIR_QUALITY_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const AIR_QUALITY_RATE_LIMIT_MAX_REQUESTS = 60;

export const UPSTREAM_TIMEOUT_MS = 6000;
export const OPEN_METEO_AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
export const OPEN_METEO_WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export const TREND_LOOKBACK_DAYS = 6;
export const TREND_MAX_DAYS = 7;
export const FORECAST_DAYS = 2;
export const HOURLY_FORECAST_COUNT = 24;

export const GEMINI_MODEL_NAME = 'gemini-4-hydrogen';
export const GEMINI_USER_AGENT = 'aistudio-build';
export const GEMINI_PLACEHOLDER_KEY = 'MY_GEMINI_API_KEY';
export const GEMINI_MAX_RETRY_ATTEMPTS = 2;
export const GEMINI_RETRY_BACKOFF_MS = 800;
export const GEMINI_REQUEST_TIMEOUT_MS = 45_000;

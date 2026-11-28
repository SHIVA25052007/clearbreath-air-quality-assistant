import type { HourlyForecastPoint, LocationTelemetry } from '../../types/airQuality.ts';
import {
  aggregateDailyTrend,
  computeWinterInversionRisk,
  estimateUsAqiFromPm25,
  roundToOneDecimal,
} from '../../utils/airQuality.ts';
import { HOURLY_FORECAST_COUNT, TREND_MAX_DAYS } from '../constants.ts';

export interface OpenMeteoAirQualityResponse {
  timezone?: string;
  current?: {
    time?: string;
    us_aqi?: number | null;
    european_aqi?: number | null;
    pm10?: number | null;
    pm2_5?: number | null;
    carbon_monoxide?: number | null;
    nitrogen_dioxide?: number | null;
    sulphur_dioxide?: number | null;
    ozone?: number | null;
  };
  hourly?: {
    time?: string[];
    pm2_5?: Array<number | null>;
    pm10?: Array<number | null>;
    us_aqi?: Array<number | null>;
  };
}

export interface OpenMeteoWeatherResponse {
  current?: {
    temperature_2m?: number | null;
    relative_humidity_2m?: number | null;
    wind_speed_10m?: number | null;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
  };
}

export interface OpenMeteoGeocodingMatch {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

export interface OpenMeteoGeocodingResponse {
  results?: OpenMeteoGeocodingMatch[];
}

export class UpstreamServiceError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'UpstreamServiceError';
    this.status = status;
  }
}

function isFiniteMetric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function mapOpenMeteoToTelemetry(params: {
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  aqData: OpenMeteoAirQualityResponse;
  weatherData: OpenMeteoWeatherResponse;
  nowMs?: number;
}): LocationTelemetry {
  const { city, region, country, latitude, longitude, aqData, weatherData } = params;
  const nowMs = params.nowMs ?? Date.now();
  const currentAq = aqData.current ?? {};
  const currentWeather = weatherData.current ?? {};
  const estimatedFields: string[] = [];

  const hasPm25 = isFiniteMetric(currentAq.pm2_5);
  const hasPm10 = isFiniteMetric(currentAq.pm10);
  const hasUsAqi = isFiniteMetric(currentAq.us_aqi);

  if (!hasPm25 && !hasPm10 && !hasUsAqi) {
    throw new UpstreamServiceError(
      'Live particulate sensor readings are currently unavailable for this location.',
      502
    );
  }

  let pm25: number;
  if (hasPm25) {
    pm25 = roundToOneDecimal(currentAq.pm2_5!);
  } else if (hasPm10) {
    pm25 = roundToOneDecimal(currentAq.pm10! * 0.65);
    estimatedFields.push('PM2.5');
  } else {
    pm25 = roundToOneDecimal(Math.max(5, currentAq.us_aqi! * 0.4));
    estimatedFields.push('PM2.5');
  }

  const pm10 = hasPm10 ? roundToOneDecimal(currentAq.pm10!) : roundToOneDecimal(pm25 * 1.5);
  if (!hasPm10) estimatedFields.push('PM10');

  const usAqi = hasUsAqi ? Math.round(currentAq.us_aqi!) : estimateUsAqiFromPm25(pm25);
  if (!hasUsAqi) estimatedFields.push('US AQI');

  const tempC = isFiniteMetric(currentWeather.temperature_2m)
    ? roundToOneDecimal(currentWeather.temperature_2m)
    : 10;
  if (!isFiniteMetric(currentWeather.temperature_2m)) estimatedFields.push('Temp');

  const windKmh = isFiniteMetric(currentWeather.wind_speed_10m)
    ? roundToOneDecimal(currentWeather.wind_speed_10m)
    : 6;
  if (!isFiniteMetric(currentWeather.wind_speed_10m)) estimatedFields.push('Wind');

  const no2 = isFiniteMetric(currentAq.nitrogen_dioxide)
    ? roundToOneDecimal(currentAq.nitrogen_dioxide)
    : 22;
  if (!isFiniteMetric(currentAq.nitrogen_dioxide)) estimatedFields.push('NO2');

  const so2 = isFiniteMetric(currentAq.sulphur_dioxide)
    ? roundToOneDecimal(currentAq.sulphur_dioxide)
    : 6;
  const o3 = isFiniteMetric(currentAq.ozone) ? roundToOneDecimal(currentAq.ozone) : 34;
  const coUgM3 = isFiniteMetric(currentAq.carbon_monoxide)
    ? Math.round(currentAq.carbon_monoxide)
    : 450;
  const humidityPct = isFiniteMetric(currentWeather.relative_humidity_2m)
    ? Math.round(currentWeather.relative_humidity_2m)
    : 65;
  if (!isFiniteMetric(currentWeather.relative_humidity_2m)) estimatedFields.push('Humidity');

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
      wind: roundToOneDecimal(hourlyWind[i] ?? windKmh),
      temp: roundToOneDecimal(hourlyTemp[i] ?? tempC),
    });
  }

  let startIdx = times.findIndex((t) => new Date(t).getTime() >= nowMs - 3600 * 1000);
  if (startIdx < 0) startIdx = Math.max(0, times.length - HOURLY_FORECAST_COUNT);

  const hourly: HourlyForecastPoint[] = [];
  for (let i = startIdx; i < Math.min(times.length, startIdx + HOURLY_FORECAST_COUNT); i++) {
    const timeIso = times[i];
    const hourPart = timeIso.split('T')[1]?.slice(0, 5) ?? `${String(i % 24).padStart(2, '0')}:00`;
    const ptPm25 = roundToOneDecimal(hourlyPm25[i] ?? pm25);
    const ptPm10 = roundToOneDecimal(hourlyPm10[i] ?? pm10);
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

  if (hourly.length === 0) {
    throw new UpstreamServiceError(
      'Hourly forecast data is currently unavailable for this location.',
      502
    );
  }

  const todayDateStr = (currentAq.time ?? new Date(nowMs).toISOString()).slice(0, 10);
  let historicalEndIdx = -1;
  for (let i = times.length - 1; i >= 0; i--) {
    if (times[i].slice(0, 10) <= todayDateStr) {
      historicalEndIdx = i;
      break;
    }
  }
  const trendSliceEnd = historicalEndIdx >= 0 ? historicalEndIdx + 1 : times.length;
  const trendTimes = times.slice(0, trendSliceEnd);
  const trendPm25 = hourlyPm25.slice(0, trendSliceEnd);
  const hasHistoricalPm = trendTimes.some(
    (t, idx) => typeof t === 'string' && t.includes('T') && isFiniteMetric(trendPm25[idx])
  );
  if (!hasHistoricalPm) {
    estimatedFields.push('7-Day Trend');
  }

  const weeklyTrend = aggregateDailyTrend(
    trendTimes,
    trendPm25,
    hourlyAqi.slice(0, trendSliceEnd),
    pm25,
    TREND_MAX_DAYS
  );

  return {
    city,
    region,
    country,
    latitude,
    longitude,
    timezone: aqData.timezone ?? 'UTC',
    observedAtIso: currentAq.time ?? new Date(nowMs).toISOString(),
    usAqi,
    europeanAqi: Math.round(currentAq.european_aqi ?? usAqi * 0.55),
    pm25,
    pm10,
    no2,
    so2,
    o3,
    coUgM3,
    tempC,
    windKmh,
    humidityPct,
    inversionRisk: computeWinterInversionRisk(pm25, windKmh, tempC),
    hourly,
    weeklyTrend,
    dataSource: 'live',
    ...(estimatedFields.length > 0 ? { estimatedFields } : {}),
  };
}

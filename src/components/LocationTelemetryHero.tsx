import { lazy, memo, Suspense, useState, type FormEvent } from 'react';
import { Search, Thermometer, Wind } from 'lucide-react';
import { PRESET_CITIES } from '../data/presetCities';
import type { LocationTelemetry } from '../types/airQuality';
import { getAqiCategory } from '../utils/airQuality';
import { HourlySmogChart } from './HourlySmogChart';

const WeeklyTrendChart = lazy(() =>
  import('./WeeklyTrendChart').then((mod) => ({ default: mod.WeeklyTrendChart }))
);

interface LocationTelemetryHeroProps {
  telemetry: LocationTelemetry;
  isLoading: boolean;
  errorMessage: string | null;
  onSearchCity: (city: string) => void;
  onSelectPreset: (cityTelemetry: LocationTelemetry) => void;
}

export const LocationTelemetryHero = memo(function LocationTelemetryHero({
  telemetry,
  isLoading,
  errorMessage,
  onSearchCity,
  onSelectPreset,
}: LocationTelemetryHeroProps) {
  const [query, setQuery] = useState('');
  const aqiInfo = getAqiCategory(telemetry.usAqi);
  const isPresetSample = telemetry.dataSource === 'preset';
  const hasEstimatedFields = (telemetry.estimatedFields?.length ?? 0) > 0;

  const sourceSummaryLabel = isPresetSample
    ? 'Sample Reference Data (Not Live)'
    : hasEstimatedFields
    ? 'Live Open-Meteo Feed (Partial Estimates)'
    : 'Live Open-Meteo Feed';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearchCity(query.trim());
  };

  return (
    <section
      id="telemetry-section"
      aria-labelledby="hero-heading"
      className="mx-auto max-w-7xl px-4 pt-8 pb-6 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-wide text-teal-800">
            Winter Smog Resilience · Family &amp; Community Exposure Planner
          </p>
          <h1
            id="hero-heading"
            className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl [text-wrap:balance]"
          >
            Breathe safer through winter smog with measurable daily choices
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Inspect atmospheric particulate levels, identify the cleanest hours to air out your home, and see the estimated health and emissions impact of every routine swap.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
          role="search"
          aria-label="Search city air quality"
        >
          <div className="relative flex-1">
            <label htmlFor="city-search-input" className="sr-only">
              Search city or urban region
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              id="city-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city (e.g., Delhi, Krakow, Seoul)"
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-teal-700"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || query.trim().length < 2}
            className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Loading...' : 'Check City'}
          </button>
        </form>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Quick city presets">
        <span className="mr-1 text-xs font-medium text-slate-600">Quick cities:</span>
        {PRESET_CITIES.map((preset) => {
          const isActive = preset.city.toLowerCase() === telemetry.city.toLowerCase();
          return (
            <button
              key={preset.city}
              type="button"
              onClick={() => onSelectPreset(preset)}
              aria-pressed={isActive}
              className={`min-h-[36px] rounded-md border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-teal-700 bg-teal-50 text-teal-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {preset.city}
            </button>
          );
        })}
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {isLoading
          ? 'Loading live air quality telemetry...'
          : `Showing ${isPresetSample ? 'sample reference' : 'live'} air quality data for ${telemetry.city}. US AQI ${telemetry.usAqi}, ${aqiInfo.label}.`}
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
        {/* Left: Primary AQI & Pollutant Instrument */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span className="font-medium text-slate-800">
                {telemetry.city}
                {telemetry.region ? `, ${telemetry.region}` : ''}
                {telemetry.country ? `, ${telemetry.country}` : ''}
              </span>
              <span
                data-testid="telemetry-source-badge"
                className={`whitespace-nowrap font-medium ${
                  isPresetSample ? 'text-amber-800' : 'text-teal-800'
                }`}
              >
                {sourceSummaryLabel}
              </span>
            </div>

            <div className="mt-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-medium text-slate-600">US Air Quality Index</p>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    data-testid="current-aqi-value"
                    className="font-mono text-5xl font-semibold tracking-tight text-slate-900 tabular-nums"
                  >
                    {telemetry.usAqi}
                  </span>
                  <span
                    className={`text-sm font-semibold whitespace-nowrap ${aqiInfo.textColorClass}`}
                  >
                    {aqiInfo.symbol} {aqiInfo.label}
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium text-slate-600">PM2.5</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                  {telemetry.pm25.toFixed(1)}
                  <span className="ml-1 text-xs font-normal text-slate-600">µg/m³</span>
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-700">{aqiInfo.guidance}</p>

            {(isPresetSample || hasEstimatedFields) && (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {isPresetSample
                  ? 'Reference sample city values shown for planning. Search a city or select a preset when online to fetch live station data.'
                  : `Live station feed active; fallback estimates were used for: ${telemetry.estimatedFields?.join(', ')}.`}
              </p>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs text-slate-600">PM10 Coarse</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {telemetry.pm10.toFixed(1)} <span className="text-xs font-normal text-slate-600">µg/m³</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-600">NO₂ Traffic</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {telemetry.no2.toFixed(1)} <span className="text-xs font-normal text-slate-600">µg/m³</span>
              </p>
            </div>
            <div className="flex items-start gap-1.5">
              <Wind className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <div>
                <p className="text-xs text-slate-600">Wind · Risk</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                  {telemetry.windKmh.toFixed(1)} km/h · {telemetry.inversionRisk}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <Thermometer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
              <div>
                <p className="text-xs text-slate-600">Temp · RH</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                  {telemetry.tempC.toFixed(0)}°C · {telemetry.humidityPct}%
                </p>
              </div>
            </div>
          </div>
        </div>

        <HourlySmogChart telemetry={telemetry} isLoading={isLoading} />
      </div>

      <Suspense
        fallback={
          <div
            role="status"
            aria-label="Loading 7-day pollution pattern chart"
            className="mt-6 h-72 w-full animate-pulse rounded-xl border border-slate-200 bg-white p-6"
          />
        }
      >
        <WeeklyTrendChart
          weeklyTrend={telemetry.weeklyTrend}
          cityName={telemetry.city}
          isLoading={isLoading}
          isSampleData={
            isPresetSample || Boolean(telemetry.estimatedFields?.includes('7-Day Trend'))
          }
        />
      </Suspense>
    </section>
  );
});

import React, { useState } from 'react';
import { Search, Wind, Thermometer, Droplets, Clock } from 'lucide-react';
import type { LocationTelemetry } from '../types/airQuality';
import {
  findCleanestVentilationWindow,
  getAqiCategory,
  PRESET_CITIES,
} from '../utils/airQuality';
import { WeeklyTrendChart } from './WeeklyTrendChart';

interface LocationTelemetryHeroProps {
  telemetry: LocationTelemetry;
  isLoading: boolean;
  errorMessage: string | null;
  onSearchCity: (city: string) => void;
  onSelectPreset: (cityTelemetry: LocationTelemetry) => void;
}

export function LocationTelemetryHero({
  telemetry,
  isLoading,
  errorMessage,
  onSearchCity,
  onSelectPreset,
}: LocationTelemetryHeroProps) {
  const [query, setQuery] = useState('');
  const [hoveredHourIndex, setHoveredHourIndex] = useState<number | null>(null);

  const aqiInfo = getAqiCategory(telemetry.usAqi);
  const ventWindow = findCleanestVentilationWindow(telemetry.hourly);

  const maxHourlyPm = Math.max(
    40,
    ...telemetry.hourly.map((h) => h.pm25)
  );

  const activeHour =
    hoveredHourIndex !== null && telemetry.hourly[hoveredHourIndex]
      ? telemetry.hourly[hoveredHourIndex]
      : null;

  const handleSubmit = (e: React.FormEvent) => {
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
            Inspect live particulate levels, identify the cleanest hours to air out your home, and see the direct health and emissions impact of every routine swap.
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
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="city-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search city (e.g., Delhi, Krakow, Seoul)"
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
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

      <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Quick city presets">
        <span className="mr-1 text-xs font-medium text-slate-500">Quick cities:</span>
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
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">
                {telemetry.city}
                {telemetry.region ? `, ${telemetry.region}` : ''}
                {telemetry.country ? `, ${telemetry.country}` : ''}
              </span>
              <span className="whitespace-nowrap">
                {telemetry.dataSource === 'live' ? 'Live Atmospheric Feed' : 'Winter Smog Reference'} · Inversion Risk: {telemetry.inversionRisk}
              </span>
            </div>

            <div className="mt-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-medium text-slate-500">US Air Quality Index</p>
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
                <p className="text-xs font-medium text-slate-500">PM2.5</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                  {telemetry.pm25.toFixed(1)}
                  <span className="ml-1 text-xs font-normal text-slate-500">µg/m³</span>
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-700">{aqiInfo.guidance}</p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">PM10 Coarse</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {telemetry.pm10.toFixed(1)} <span className="text-xs font-normal text-slate-500">µg/m³</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">NO₂ Traffic</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {telemetry.no2.toFixed(1)} <span className="text-xs font-normal text-slate-500">µg/m³</span>
              </p>
            </div>
            <div className="flex items-start gap-1.5">
              <Wind className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <p className="text-xs text-slate-500">Wind</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                  {telemetry.windKmh.toFixed(1)} km/h
                </p>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <Thermometer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <p className="text-xs text-slate-500">Temp · RH</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                  {telemetry.tempC.toFixed(0)}°C · {telemetry.humidityPct}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: 24-Hour Smog Curve & Cleanest Ventilation Window */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                24-Hour PM2.5 Inversion Curve
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Hourly particulate forecast (µg/m³) · Dashed line marks WHO 24h limit (15 µg/m³)
              </p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 whitespace-nowrap">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Best Airing: <span className="font-mono tabular-nums">{ventWindow.startLabel}–{ventWindow.endLabel}</span>
              </p>
              <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                Trough avg {ventWindow.avgPm25} µg/m³ · AQI {ventWindow.avgUsAqi}
              </p>
            </div>
          </div>

          <div className="mt-5">
            {isLoading ? (
              <div className="h-44 w-full animate-pulse rounded-lg bg-slate-100" aria-label="Loading hourly forecast" />
            ) : (
              <div className="relative">
                <svg
                  viewBox="0 0 600 180"
                  className="h-44 w-full overflow-visible"
                  role="img"
                  aria-label={`24-hour PM2.5 forecast chart for ${telemetry.city}. Cleanest window is ${ventWindow.startLabel} to ${ventWindow.endLabel}.`}
                >
                  {/* WHO 24h Guideline reference line (15 µg/m³) */}
                  {(() => {
                    const whoY = 148 - Math.min(130, (15 / maxHourlyPm) * 130);
                    return (
                      <line
                        x1="0"
                        y1={whoY}
                        x2="600"
                        y2={whoY}
                        stroke="#0f766e"
                        strokeDasharray="4 4"
                        strokeWidth="1.25"
                        opacity="0.65"
                      />
                    );
                  })()}

                  {telemetry.hourly.slice(0, 24).map((point, idx) => {
                    const barWidth = 18;
                    const gap = 7;
                    const x = idx * (barWidth + gap) + 4;
                    const height = Math.max(6, (point.pm25 / maxHourlyPm) * 130);
                    const y = 148 - height;
                    const isCleanWindow =
                      point.hourLabel === ventWindow.startLabel ||
                      point.hourLabel === ventWindow.endLabel;
                    const isHovered = hoveredHourIndex === idx;
                    const pointCat = getAqiCategory(point.usAqi);

                    return (
                      <g
                        key={`${point.timeIso}-${idx}`}
                        tabIndex={0}
                        role="button"
                        aria-label={`${point.hourLabel}: PM2.5 ${point.pm25} µg/m³, US AQI ${point.usAqi}, Wind ${point.windKmh} km/h`}
                        onMouseEnter={() => setHoveredHourIndex(idx)}
                        onMouseLeave={() => setHoveredHourIndex(null)}
                        onFocus={() => setHoveredHourIndex(idx)}
                        onBlur={() => setHoveredHourIndex(null)}
                        className="cursor-pointer outline-none"
                      >
                        {isCleanWindow && (
                          <rect
                            x={x - 2}
                            y={10}
                            width={barWidth + 4}
                            height={140}
                            rx="3"
                            fill="#0f766e"
                            opacity="0.09"
                          />
                        )}
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={height}
                          rx="3"
                          fill={isCleanWindow ? '#0f766e' : pointCat.barColorHex}
                          opacity={isHovered ? 1 : isCleanWindow ? 0.92 : 0.72}
                        />
                        {idx % 4 === 0 && (
                          <text
                            x={x + barWidth / 2}
                            y={168}
                            textAnchor="middle"
                            className="fill-slate-500 font-mono text-[10px]"
                          >
                            {point.hourLabel}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-slate-600">
              {activeHour ? (
                <span>
                  <span className="font-mono font-semibold text-slate-900">{activeHour.hourLabel}</span>
                  {' · '}
                  <span className="font-mono tabular-nums">{activeHour.pm25} µg/m³ PM2.5</span>
                  {' · '}
                  <span className="font-mono tabular-nums">US AQI {activeHour.usAqi}</span>
                  {' · '}
                  <span className="font-mono tabular-nums">Wind {activeHour.windKmh} km/h</span>
                </span>
              ) : (
                ventWindow.reason
              )}
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap shrink-0">
              <Droplets className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
              Target indoor RH: 40–50%
            </span>
          </div>
        </div>
      </div>

      <WeeklyTrendChart
        weeklyTrend={telemetry.weeklyTrend}
        cityName={telemetry.city}
        isLoading={isLoading}
      />
    </section>
  );
}

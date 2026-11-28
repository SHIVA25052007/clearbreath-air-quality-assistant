import { memo, useState } from 'react';
import { Clock, Droplets } from 'lucide-react';
import type { LocationTelemetry } from '../types/airQuality';
import {
  findCleanestVentilationWindow,
  getAqiCategory,
  WHO_PM25_24H_GUIDELINE_UG_M3,
} from '../utils/airQuality';

interface HourlySmogChartProps {
  telemetry: LocationTelemetry;
  isLoading: boolean;
}

export const HourlySmogChart = memo(function HourlySmogChart({
  telemetry,
  isLoading,
}: HourlySmogChartProps) {
  const [hoveredHourIndex, setHoveredHourIndex] = useState<number | null>(null);
  const ventWindow = findCleanestVentilationWindow(telemetry.hourly);
  const maxHourlyPm = Math.max(40, ...telemetry.hourly.map((h) => h.pm25));

  const activeHour =
    hoveredHourIndex !== null && telemetry.hourly[hoveredHourIndex]
      ? telemetry.hourly[hoveredHourIndex]
      : null;

  const isSample = telemetry.dataSource === 'preset';

  return (
    <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            24-Hour PM2.5 Inversion Curve
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            {isSample ? 'Reference diurnal pattern' : 'Hourly forecast'} (µg/m³) · Dashed line marks WHO 24h limit ({WHO_PM25_24H_GUIDELINE_UG_M3} µg/m³)
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 whitespace-nowrap">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Best Airing: <span className="font-mono tabular-nums">{ventWindow.startLabel}–{ventWindow.endLabel}</span>
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
            Trough avg {ventWindow.avgPm25} µg/m³ · AQI {ventWindow.avgUsAqi}
          </p>
        </div>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading 24-hour particulate forecast"
            className="flex h-44 w-full items-center justify-center rounded-lg bg-slate-100 text-xs font-medium text-slate-600 animate-pulse"
          >
            Loading hourly forecast...
          </div>
        ) : (
          <div className="relative">
            <p className="sr-only">
              24-hour PM2.5 chart for {telemetry.city}. Cleanest 2-hour ventilation window is {ventWindow.startLabel} to {ventWindow.endLabel} with an average of {ventWindow.avgPm25} micrograms per cubic meter. Use Tab to inspect individual hours.
            </p>
            <svg
              viewBox="0 0 600 184"
              className="h-44 w-full overflow-visible"
              role="group"
              aria-label={`24-hour PM2.5 forecast chart for ${telemetry.city}. Cleanest window is ${ventWindow.startLabel} to ${ventWindow.endLabel}.`}
            >
              {/* WHO 24h Guideline reference line */}
              {(() => {
                const whoY =
                  148 - Math.min(130, (WHO_PM25_24H_GUIDELINE_UG_M3 / maxHourlyPm) * 130);
                return (
                  <line
                    x1="0"
                    y1={whoY}
                    x2="600"
                    y2={whoY}
                    stroke="#0f766e"
                    strokeDasharray="4 4"
                    strokeWidth="1.25"
                    opacity="0.7"
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
                    className="cursor-pointer"
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
                      opacity={isHovered ? 1 : isCleanWindow ? 0.92 : 0.74}
                      stroke={isHovered ? '#0f172a' : 'none'}
                      strokeWidth={isHovered ? 1.5 : 0}
                    />
                    {idx % 4 === 0 && (
                      <text
                        x={x + barWidth / 2}
                        y={170}
                        textAnchor="middle"
                        className="fill-slate-600 font-mono text-xs"
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
        <p className="text-xs leading-relaxed text-slate-600" aria-live="polite">
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
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap shrink-0">
          <Droplets className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
          Target indoor RH: 40–50%
        </span>
      </div>
    </div>
  );
});

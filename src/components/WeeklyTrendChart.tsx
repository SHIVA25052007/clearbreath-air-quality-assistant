import { memo, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { max } from 'd3-array';
import { scaleLinear, scalePoint } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { DailyTrendPoint } from '../types/airQuality';
import {
  getAqiCategory,
  US_AQI_SENSITIVE_THRESHOLD,
  WHO_PM25_24H_GUIDELINE_UG_M3,
} from '../utils/airQuality';
import {
  computeWeeklyTrendStats,
  mapWeeklyTrendMetric,
  type TrendMetric,
  type WeeklyTrendPointDatum,
} from '../utils/weeklyTrendStats';

interface WeeklyTrendChartProps {
  weeklyTrend: DailyTrendPoint[];
  cityName: string;
  isLoading: boolean;
  isSampleData?: boolean;
}

const CHART_WIDTH = 920;
const CHART_HEIGHT = 224;
const CHART_MARGIN = { top: 18, right: 24, bottom: 38, left: 48 };
const INNER_WIDTH = CHART_WIDTH - CHART_MARGIN.left - CHART_MARGIN.right;
const INNER_HEIGHT = CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom;

export const WeeklyTrendChart = memo(function WeeklyTrendChart({
  weeklyTrend,
  cityName,
  isLoading,
  isSampleData = false,
}: WeeklyTrendChartProps) {
  const [metric, setMetric] = useState<TrendMetric>('pm25');
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const pmTabRef = useRef<HTMLButtonElement | null>(null);
  const aqiTabRef = useRef<HTMLButtonElement | null>(null);

  const chartData = useMemo(
    () => mapWeeklyTrendMetric(weeklyTrend, metric),
    [weeklyTrend, metric]
  );

  const stats = useMemo(
    () => computeWeeklyTrendStats(chartData, weeklyTrend),
    [chartData, weeklyTrend]
  );

  const geometry = useMemo(() => {
    if (chartData.length === 0) return null;

    const maxPeak = max(chartData, (d) => d.peakVal) ?? 50;
    const guidelineVal =
      metric === 'pm25' ? WHO_PM25_24H_GUIDELINE_UG_M3 : US_AQI_SENSITIVE_THRESHOLD;
    const yMax = Math.max(
      metric === 'pm25' ? 35 : 120,
      Math.ceil(Math.max(maxPeak, guidelineVal) * 1.12)
    );

    const xScale = scalePoint<string>()
      .domain(chartData.map((d) => d.dateIso))
      .range([0, INNER_WIDTH])
      .padding(0.25);

    const yScale = scaleLinear()
      .domain([0, yMax])
      .nice(4)
      .range([INNER_HEIGHT, 0]);

    const avgAreaGen = area<WeeklyTrendPointDatum>()
      .x((d) => xScale(d.dateIso) ?? 0)
      .y0(INNER_HEIGHT)
      .y1((d) => yScale(d.avgVal))
      .curve(curveMonotoneX);

    const rangeAreaGen = area<WeeklyTrendPointDatum>()
      .x((d) => xScale(d.dateIso) ?? 0)
      .y0((d) => yScale(d.avgVal))
      .y1((d) => yScale(d.peakVal))
      .curve(curveMonotoneX);

    const avgLineGen = line<WeeklyTrendPointDatum>()
      .x((d) => xScale(d.dateIso) ?? 0)
      .y((d) => yScale(d.avgVal))
      .curve(curveMonotoneX);

    const peakLineGen = line<WeeklyTrendPointDatum>()
      .x((d) => xScale(d.dateIso) ?? 0)
      .y((d) => yScale(d.peakVal))
      .curve(curveMonotoneX);

    return {
      xScale,
      yScale,
      yTicks: yScale.ticks(4),
      guidelineVal,
      guidelineY: yScale(guidelineVal),
      avgAreaPath: avgAreaGen(chartData) ?? '',
      rangeAreaPath: rangeAreaGen(chartData) ?? '',
      avgLinePath: avgLineGen(chartData) ?? '',
      peakLinePath: peakLineGen(chartData) ?? '',
    };
  }, [chartData, metric]);

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const nextMetric: TrendMetric =
        e.key === 'Home'
          ? 'pm25'
          : e.key === 'End'
          ? 'aqi'
          : metric === 'pm25'
          ? 'aqi'
          : 'pm25';
      setMetric(nextMetric);
      (nextMetric === 'pm25' ? pmTabRef : aqiTabRef).current?.focus();
    }
  };

  const inspectedPoint =
    activeIdx !== null && chartData[activeIdx] ? chartData[activeIdx] : null;
  const inspectedCategory = inspectedPoint
    ? getAqiCategory(inspectedPoint.avgUsAqi)
    : null;

  const unitLabel = metric === 'pm25' ? 'µg/m³' : 'US AQI';

  return (
    <div
      data-testid="weekly-trend-panel"
      className="mt-6 rounded-xl border border-slate-200 bg-white p-6"
    >
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            7-Day Pollution Pattern · {cityName}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            {isSampleData ? 'Sample weekly pattern (not live readings) · ' : ''}
            Daily mean (solid teal) vs. daily peak spike (dashed slate) · Hover or focus points to inspect
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div>
              <p className="text-slate-600">7-Day Mean</p>
              <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                {stats.avg7d} <span className="font-normal text-slate-600">{unitLabel}</span>
              </p>
            </div>
            <div>
              <p className="text-slate-600">Weekly Peak</p>
              <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                {stats.peak7d} <span className="font-normal text-slate-600">{unitLabel}</span>
              </p>
            </div>
            <div>
              <p className="text-slate-600">Days &gt; WHO 24h</p>
              <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                {stats.daysOverGuideline} / {weeklyTrend.length || 7}
              </p>
            </div>
            <div>
              <p className="text-slate-600">Weekly Trajectory</p>
              <p className="mt-0.5 inline-flex items-center gap-1 font-mono font-semibold text-slate-900 tabular-nums">
                {stats.direction === 'Rising' ? (
                  <TrendingUp className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
                ) : stats.direction === 'Easing' ? (
                  <TrendingDown className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
                )}
                <span>
                  {stats.direction}
                  {stats.deltaPct !== 0
                    ? ` (${stats.deltaPct > 0 ? '+' : ''}${stats.deltaPct}%)`
                    : ''}
                </span>
              </p>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Weekly trend metric"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 shrink-0"
          >
            <button
              ref={pmTabRef}
              id="weekly-tab-pm25"
              type="button"
              role="tab"
              aria-selected={metric === 'pm25'}
              aria-controls="weekly-trend-tabpanel"
              tabIndex={metric === 'pm25' ? 0 : -1}
              onClick={() => setMetric('pm25')}
              onKeyDown={handleTabKeyDown}
              className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                metric === 'pm25'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PM2.5 (µg/m³)
            </button>
            <button
              ref={aqiTabRef}
              id="weekly-tab-aqi"
              type="button"
              role="tab"
              aria-selected={metric === 'aqi'}
              aria-controls="weekly-trend-tabpanel"
              tabIndex={metric === 'aqi' ? 0 : -1}
              onClick={() => setMetric('aqi')}
              onKeyDown={handleTabKeyDown}
              className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                metric === 'aqi'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              US AQI
            </button>
          </div>
        </div>
      </div>

      <div
        id="weekly-trend-tabpanel"
        role="tabpanel"
        aria-labelledby={metric === 'pm25' ? 'weekly-tab-pm25' : 'weekly-tab-aqi'}
        className="mt-4"
      >
        {isLoading || !geometry ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading 7-day pollution trend chart"
            className="flex h-52 w-full items-center justify-center rounded-lg bg-slate-100 text-xs font-medium text-slate-600 animate-pulse"
          >
            Loading 7-day pollution pattern...
          </div>
        ) : (
          <div>
            <p className="sr-only">
              7-day {metric === 'pm25' ? 'PM2.5' : 'US AQI'} chart for {cityName}. 7-day mean is {stats.avg7d} {unitLabel}, peak was {stats.peak7d} {unitLabel} on {stats.peakDay}. Use Tab to inspect daily values.
            </p>
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="h-52 w-full overflow-visible"
              role="group"
              aria-label={`7-day ${metric === 'pm25' ? 'PM2.5' : 'US AQI'} trend chart for ${cityName}. 7-day average is ${stats.avg7d} ${unitLabel}.`}
            >
              <defs>
                <linearGradient id="clearbreath-weekly-avg-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0f766e" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              <g transform={`translate(${CHART_MARGIN.left}, ${CHART_MARGIN.top})`}>
                {geometry.yTicks.map((tickVal) => {
                  const y = geometry.yScale(tickVal);
                  return (
                    <g key={tickVal}>
                      <line
                        x1={0}
                        x2={INNER_WIDTH}
                        y1={y}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                      />
                      <text
                        x={-10}
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-600 font-mono text-xs"
                      >
                        {tickVal}
                      </text>
                    </g>
                  );
                })}

                {geometry.guidelineY >= 0 && geometry.guidelineY <= INNER_HEIGHT && (
                  <line
                    x1={0}
                    x2={INNER_WIDTH}
                    y1={geometry.guidelineY}
                    y2={geometry.guidelineY}
                    stroke="#0f766e"
                    strokeDasharray="3 4"
                    strokeWidth="1.25"
                    opacity="0.65"
                  />
                )}

                <path d={geometry.rangeAreaPath} fill="#64748b" opacity="0.10" />
                <path d={geometry.avgAreaPath} fill="url(#clearbreath-weekly-avg-grad)" />
                <path
                  d={geometry.peakLinePath}
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <path d={geometry.avgLinePath} fill="none" stroke="#0f766e" strokeWidth="2.5" />

                {chartData.map((pt, idx) => {
                  const cx = geometry.xScale(pt.dateIso) ?? 0;
                  const cyAvg = geometry.yScale(pt.avgVal);
                  const cyPeak = geometry.yScale(pt.peakVal);
                  const isSelected = activeIdx === idx;
                  const dayCat = getAqiCategory(pt.avgUsAqi);

                  return (
                    <g
                      key={pt.dateIso}
                      tabIndex={0}
                      role="button"
                      aria-label={`${pt.dayLabel} ${pt.shortDate}: Mean ${pt.avgVal} ${unitLabel}, Peak ${pt.peakVal} ${unitLabel}, ${dayCat.label}`}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onMouseLeave={() => setActiveIdx(null)}
                      onFocus={() => setActiveIdx(idx)}
                      onBlur={() => setActiveIdx(null)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={cx - 32}
                        y={0}
                        width={64}
                        height={INNER_HEIGHT}
                        fill="transparent"
                      />

                      {isSelected && (
                        <line
                          x1={cx}
                          x2={cx}
                          y1={0}
                          y2={INNER_HEIGHT}
                          stroke="#0f766e"
                          strokeWidth="1.25"
                          strokeDasharray="2 2"
                          opacity="0.8"
                        />
                      )}

                      <circle cx={cx} cy={cyPeak} r={isSelected ? 4 : 2.5} fill="#64748b" />
                      {isSelected && (
                        <circle
                          cx={cx}
                          cy={cyAvg}
                          r={9}
                          fill="none"
                          stroke="#0f766e"
                          strokeWidth="2"
                        />
                      )}
                      <circle
                        cx={cx}
                        cy={cyAvg}
                        r={isSelected ? 5.5 : 4}
                        fill="#ffffff"
                        stroke={dayCat.barColorHex}
                        strokeWidth="2.5"
                      />

                      <text
                        x={cx}
                        y={INNER_HEIGHT + 20}
                        textAnchor="middle"
                        className={`font-mono text-xs ${
                          isSelected ? 'fill-slate-900 font-semibold' : 'fill-slate-600'
                        }`}
                      >
                        {pt.dayLabel} · {pt.shortDate}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite">
          {inspectedPoint && inspectedCategory ? (
            <span>
              <span className="font-semibold text-slate-900">
                {inspectedPoint.dayLabel}, {inspectedPoint.shortDate}:
              </span>{' '}
              <span className="font-mono tabular-nums">
                Mean {inspectedPoint.avgVal} {unitLabel} · Peak {inspectedPoint.peakVal} {unitLabel}
              </span>{' '}
              ·{' '}
              <span className={`font-medium ${inspectedCategory.textColorClass}`}>
                {inspectedCategory.symbol} {inspectedCategory.label}
              </span>
            </span>
          ) : (
            <span>
              Peak recorded on <span className="font-medium text-slate-800">{stats.peakDay}</span>.{' '}
              {stats.direction === 'Rising'
                ? 'Particulate buildup is intensifying—keep indoor filtration running and limit morning airing.'
                : stats.direction === 'Easing'
                ? 'Dispersion is improving compared to earlier this week; watch for afternoon airing windows.'
                : 'Stagnant winter inversion is holding pollution steady across the week.'}
            </span>
          )}
        </p>

        <span className="font-mono text-xs text-slate-600 whitespace-nowrap shrink-0">
          {metric === 'pm25'
            ? `Teal dashed line: WHO 24h limit (${WHO_PM25_24H_GUIDELINE_UG_M3} µg/m³)`
            : `Teal dashed line: US AQI ${US_AQI_SENSITIVE_THRESHOLD} (Sensitive threshold)`}
        </span>
      </div>
    </div>
  );
});

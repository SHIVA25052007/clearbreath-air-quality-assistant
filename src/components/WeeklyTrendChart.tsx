import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { DailyTrendPoint } from '../types/airQuality';
import { getAqiCategory } from '../utils/airQuality';

interface WeeklyTrendChartProps {
  weeklyTrend: DailyTrendPoint[];
  cityName: string;
  isLoading: boolean;
}

type TrendMetric = 'pm25' | 'aqi';

export function WeeklyTrendChart({
  weeklyTrend,
  cityName,
  isLoading,
}: WeeklyTrendChartProps) {
  const [metric, setMetric] = useState<TrendMetric>('pm25');
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const width = 920;
  const height = 220;
  const margin = { top: 18, right: 24, bottom: 34, left: 46 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const chartData = useMemo(() => {
    return weeklyTrend.map((d) => ({
      ...d,
      avgVal: metric === 'pm25' ? d.avgPm25 : d.avgUsAqi,
      peakVal: metric === 'pm25' ? d.peakPm25 : d.peakUsAqi,
    }));
  }, [weeklyTrend, metric]);

  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return {
        avg7d: 0,
        peak7d: 0,
        peakDay: '',
        daysOverGuideline: 0,
        direction: 'Steady' as 'Rising' | 'Easing' | 'Steady',
        deltaPct: 0,
      };
    }

    const avg7d =
      Math.round(
        (chartData.reduce((sum, d) => sum + d.avgVal, 0) / chartData.length) * 10
      ) / 10;

    let peakPoint = chartData[0];
    for (const pt of chartData) {
      if (pt.peakVal > peakPoint.peakVal) {
        peakPoint = pt;
      }
    }

    const daysOverGuideline = weeklyTrend.filter((d) => d.avgPm25 > 15).length;

    const split = Math.max(1, Math.floor(chartData.length / 2));
    const earlyAvg =
      chartData.slice(0, split).reduce((s, d) => s + d.avgVal, 0) / split;
    const recentSlice = chartData.slice(-split);
    const lateAvg =
      recentSlice.reduce((s, d) => s + d.avgVal, 0) / recentSlice.length;
    const deltaPct =
      earlyAvg > 0 ? Math.round(((lateAvg - earlyAvg) / earlyAvg) * 100) : 0;

    let direction: 'Rising' | 'Easing' | 'Steady' = 'Steady';
    if (deltaPct >= 8) direction = 'Rising';
    else if (deltaPct <= -8) direction = 'Easing';

    return {
      avg7d,
      peak7d: peakPoint.peakVal,
      peakDay: `${peakPoint.dayLabel} (${peakPoint.shortDate})`,
      daysOverGuideline,
      direction,
      deltaPct,
    };
  }, [chartData, weeklyTrend]);

  const geometry = useMemo(() => {
    if (chartData.length === 0) return null;

    const maxPeak = d3.max(chartData, (d) => d.peakVal) ?? 50;
    const guidelineVal = metric === 'pm25' ? 15 : 100;
    const yMax = Math.max(metric === 'pm25' ? 35 : 120, Math.ceil(Math.max(maxPeak, guidelineVal) * 1.12));

    const xScale = d3
      .scalePoint<string>()
      .domain(chartData.map((d) => d.dateIso))
      .range([0, innerWidth])
      .padding(0.25);

    const yScale = d3
      .scaleLinear()
      .domain([0, yMax])
      .nice(4)
      .range([innerHeight, 0]);

    const avgAreaGen = d3
      .area<(typeof chartData)[number]>()
      .x((d) => xScale(d.dateIso) ?? 0)
      .y0(innerHeight)
      .y1((d) => yScale(d.avgVal))
      .curve(d3.curveMonotoneX);

    const rangeAreaGen = d3
      .area<(typeof chartData)[number]>()
      .x((d) => xScale(d.dateIso) ?? 0)
      .y0((d) => yScale(d.avgVal))
      .y1((d) => yScale(d.peakVal))
      .curve(d3.curveMonotoneX);

    const avgLineGen = d3
      .line<(typeof chartData)[number]>()
      .x((d) => xScale(d.dateIso) ?? 0)
      .y((d) => yScale(d.avgVal))
      .curve(d3.curveMonotoneX);

    const peakLineGen = d3
      .line<(typeof chartData)[number]>()
      .x((d) => xScale(d.dateIso) ?? 0)
      .y((d) => yScale(d.peakVal))
      .curve(d3.curveMonotoneX);

    const yTicks = yScale.ticks(4);

    return {
      xScale,
      yScale,
      yTicks,
      guidelineVal,
      guidelineY: yScale(guidelineVal),
      avgAreaPath: avgAreaGen(chartData) ?? '',
      rangeAreaPath: rangeAreaGen(chartData) ?? '',
      avgLinePath: avgLineGen(chartData) ?? '',
      peakLinePath: peakLineGen(chartData) ?? '',
    };
  }, [chartData, innerHeight, innerWidth, metric]);

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
          <p className="mt-0.5 text-xs text-slate-500">
            Daily mean (solid teal) vs. daily peak spike (dashed slate) · Hover or focus points to inspect daily levels
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-6 text-xs">
            <div>
              <p className="text-slate-500">7-Day Mean</p>
              <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                {stats.avg7d} <span className="font-normal text-slate-500">{unitLabel}</span>
              </p>
            </div>
            <div>
              <p className="text-slate-500">Weekly Peak</p>
              <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                {stats.peak7d} <span className="font-normal text-slate-500">{unitLabel}</span>
              </p>
            </div>
            <div>
              <p className="text-slate-500">Days &gt; WHO 24h</p>
              <p className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                {stats.daysOverGuideline} / {weeklyTrend.length || 7}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Weekly Trajectory</p>
              <p className="mt-0.5 inline-flex items-center gap-1 font-mono font-semibold text-slate-900 tabular-nums">
                {stats.direction === 'Rising' ? (
                  <TrendingUp className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
                ) : stats.direction === 'Easing' ? (
                  <TrendingDown className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
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
              type="button"
              role="tab"
              aria-selected={metric === 'pm25'}
              onClick={() => setMetric('pm25')}
              className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                metric === 'pm25'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PM2.5 (µg/m³)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={metric === 'aqi'}
              onClick={() => setMetric('aqi')}
              className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
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

      <div className="mt-4">
        {isLoading || !geometry ? (
          <div
            className="h-52 w-full animate-pulse rounded-lg bg-slate-100"
            aria-label="Loading 7-day pollution trend chart"
          />
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-52 w-full overflow-visible"
            role="img"
            aria-label={`7-day ${metric === 'pm25' ? 'PM2.5' : 'US AQI'} trend chart for ${cityName}. 7-day average is ${stats.avg7d} ${unitLabel}.`}
          >
            <defs>
              <linearGradient id="clearbreath-weekly-avg-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f766e" stopOpacity="0.20" />
                <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            <g transform={`translate(${margin.left}, ${margin.top})`}>
              {/* Horizontal gridlines & Y-axis ticks */}
              {geometry.yTicks.map((tickVal) => {
                const y = geometry.yScale(tickVal);
                return (
                  <g key={tickVal}>
                    <line
                      x1={0}
                      x2={innerWidth}
                      y1={y}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                    />
                    <text
                      x={-10}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-slate-500 font-mono text-[10px]"
                    >
                      {tickVal}
                    </text>
                  </g>
                );
              })}

              {/* WHO / Sensitive guideline threshold */}
              {geometry.guidelineY >= 0 && geometry.guidelineY <= innerHeight && (
                <line
                  x1={0}
                  x2={innerWidth}
                  y1={geometry.guidelineY}
                  y2={geometry.guidelineY}
                  stroke="#0f766e"
                  strokeDasharray="3 4"
                  strokeWidth="1.25"
                  opacity="0.6"
                />
              )}

              {/* Daily peak-to-average spread band */}
              <path
                d={geometry.rangeAreaPath}
                fill="#64748b"
                opacity="0.10"
              />

              {/* Primary 7-day mean area & curve */}
              <path
                d={geometry.avgAreaPath}
                fill="url(#clearbreath-weekly-avg-grad)"
              />
              <path
                d={geometry.peakLinePath}
                fill="none"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <path
                d={geometry.avgLinePath}
                fill="none"
                stroke="#0f766e"
                strokeWidth="2.5"
              />

              {/* Interactive day nodes */}
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
                    className="cursor-pointer outline-none"
                  >
                    {/* Wide invisible hit column */}
                    <rect
                      x={cx - 32}
                      y={0}
                      width={64}
                      height={innerHeight}
                      fill="transparent"
                    />

                    {isSelected && (
                      <line
                        x1={cx}
                        x2={cx}
                        y1={0}
                        y2={innerHeight}
                        stroke="#0f766e"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        opacity="0.7"
                      />
                    )}

                    <circle
                      cx={cx}
                      cy={cyPeak}
                      r={isSelected ? 4 : 2.5}
                      fill="#64748b"
                    />
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
                      y={innerHeight + 18}
                      textAnchor="middle"
                      className={`font-mono text-[10px] ${
                        isSelected ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
                      }`}
                    >
                      {pt.dayLabel} · {pt.shortDate}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
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

        <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap shrink-0">
          {metric === 'pm25'
            ? 'Teal dashed line: WHO 24h limit (15 µg/m³)'
            : 'Teal dashed line: US AQI 100 (Sensitive threshold)'}
        </span>
      </div>
    </div>
  );
}

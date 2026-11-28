import type { DailyTrendPoint } from '../types/airQuality';
import { roundToOneDecimal, WHO_PM25_24H_GUIDELINE_UG_M3 } from './airQuality';

export type TrendMetric = 'pm25' | 'aqi';

export interface WeeklyTrendPointDatum extends DailyTrendPoint {
  avgVal: number;
  peakVal: number;
}

export interface WeeklyTrendStats {
  avg7d: number;
  peak7d: number;
  peakDay: string;
  daysOverGuideline: number;
  direction: 'Rising' | 'Easing' | 'Steady';
  deltaPct: number;
}

export function mapWeeklyTrendMetric(
  weeklyTrend: DailyTrendPoint[],
  metric: TrendMetric
): WeeklyTrendPointDatum[] {
  return weeklyTrend.map((d) => ({
    ...d,
    avgVal: metric === 'pm25' ? d.avgPm25 : d.avgUsAqi,
    peakVal: metric === 'pm25' ? d.peakPm25 : d.peakUsAqi,
  }));
}

export function computeWeeklyTrendStats(
  chartData: WeeklyTrendPointDatum[],
  weeklyTrend: DailyTrendPoint[]
): WeeklyTrendStats {
  if (chartData.length === 0) {
    return {
      avg7d: 0,
      peak7d: 0,
      peakDay: '',
      daysOverGuideline: 0,
      direction: 'Steady',
      deltaPct: 0,
    };
  }

  const avg7d = roundToOneDecimal(
    chartData.reduce((sum, d) => sum + d.avgVal, 0) / chartData.length
  );

  let peakPoint = chartData[0];
  for (const pt of chartData) {
    if (pt.peakVal > peakPoint.peakVal) {
      peakPoint = pt;
    }
  }

  const daysOverGuideline = weeklyTrend.filter(
    (d) => d.avgPm25 > WHO_PM25_24H_GUIDELINE_UG_M3
  ).length;

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
}

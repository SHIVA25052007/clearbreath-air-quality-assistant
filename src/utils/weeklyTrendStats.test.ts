import test from 'node:test';
import assert from 'node:assert/strict';
import type { DailyTrendPoint } from '../types/airQuality';
import { computeWeeklyTrendStats, mapWeeklyTrendMetric } from './weeklyTrendStats';

const RISING_TREND: DailyTrendPoint[] = [
  { dateIso: '2026-11-21', dayLabel: 'Sat', shortDate: 'Nov 21', avgPm25: 12, peakPm25: 20, avgUsAqi: 50, peakUsAqi: 68 },
  { dateIso: '2026-11-22', dayLabel: 'Sun', shortDate: 'Nov 22', avgPm25: 14, peakPm25: 24, avgUsAqi: 55, peakUsAqi: 76 },
  { dateIso: '2026-11-23', dayLabel: 'Mon', shortDate: 'Nov 23', avgPm25: 18, peakPm25: 32, avgUsAqi: 63, peakUsAqi: 93 },
  { dateIso: '2026-11-24', dayLabel: 'Tue', shortDate: 'Nov 24', avgPm25: 30, peakPm25: 55, avgUsAqi: 89, peakUsAqi: 149 },
  { dateIso: '2026-11-25', dayLabel: 'Wed', shortDate: 'Nov 25', avgPm25: 44, peakPm25: 78, avgUsAqi: 122, peakUsAqi: 162 },
  { dateIso: '2026-11-26', dayLabel: 'Thu', shortDate: 'Nov 26', avgPm25: 52, peakPm25: 90, avgUsAqi: 142, peakUsAqi: 169 },
];

const EASING_TREND: DailyTrendPoint[] = [...RISING_TREND].reverse();

test('mapWeeklyTrendMetric projects PM2.5 or US AQI series accurately', () => {
  const pmSeries = mapWeeklyTrendMetric(RISING_TREND, 'pm25');
  assert.equal(pmSeries[0].avgVal, 12);
  assert.equal(pmSeries[0].peakVal, 20);

  const aqiSeries = mapWeeklyTrendMetric(RISING_TREND, 'aqi');
  assert.equal(aqiSeries[0].avgVal, 50);
  assert.equal(aqiSeries[0].peakVal, 68);
});

test('computeWeeklyTrendStats classifies rising, easing, and empty series cleanly', () => {
  const risingStats = computeWeeklyTrendStats(
    mapWeeklyTrendMetric(RISING_TREND, 'pm25'),
    RISING_TREND
  );
  assert.equal(risingStats.direction, 'Rising');
  assert.equal(risingStats.peak7d, 90);
  assert.equal(risingStats.peakDay, 'Thu (Nov 26)');
  assert.equal(risingStats.daysOverGuideline, 4);
  assert.ok(risingStats.deltaPct >= 8);

  const easingStats = computeWeeklyTrendStats(
    mapWeeklyTrendMetric(EASING_TREND, 'aqi'),
    EASING_TREND
  );
  assert.equal(easingStats.direction, 'Easing');
  assert.equal(easingStats.peak7d, 169);
  assert.ok(easingStats.deltaPct <= -8);

  const emptyStats = computeWeeklyTrendStats([], []);
  assert.equal(emptyStats.direction, 'Steady');
  assert.equal(emptyStats.avg7d, 0);
  assert.equal(emptyStats.peakDay, '');
});

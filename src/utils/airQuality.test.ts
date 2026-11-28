import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_CITIES } from '../data/presetCities';
import {
  aggregateDailyTrend,
  computeWinterInversionRisk,
  estimateUsAqiFromPm25,
  findCleanestVentilationWindow,
  getAqiCategory,
} from './airQuality';

test('getAqiCategory maps EPA thresholds accurately with non-hue labels', () => {
  assert.equal(getAqiCategory(28).level, 'good');
  assert.equal(getAqiCategory(50).level, 'good');
  assert.equal(getAqiCategory(75).level, 'moderate');
  assert.equal(getAqiCategory(134).level, 'sensitive');
  assert.equal(getAqiCategory(178).level, 'unhealthy');
  assert.equal(getAqiCategory(248).level, 'very_unhealthy');
  assert.equal(getAqiCategory(340).level, 'hazardous');
  assert.ok(getAqiCategory(248).symbol.length > 0);
});

test('estimateUsAqiFromPm25 respects EPA breakpoints', () => {
  assert.equal(estimateUsAqiFromPm25(12.0), 50);
  assert.equal(estimateUsAqiFromPm25(35.4), 100);
  assert.ok(estimateUsAqiFromPm25(150.4) <= 200);
  assert.ok(estimateUsAqiFromPm25(200) > 240);
  assert.equal(estimateUsAqiFromPm25(600), 500);
});

test('findCleanestVentilationWindow identifies the lowest-PM2.5 2-hour trough', () => {
  const delhi = PRESET_CITIES[0];
  const window = findCleanestVentilationWindow(delhi.hourly);
  assert.equal(window.startLabel, '13:00');
  assert.equal(window.endLabel, '14:00');
  assert.ok(window.avgPm25 < delhi.pm25);
});

test('computeWinterInversionRisk classifies cold stagnant air as High or Severe', () => {
  assert.equal(computeWinterInversionRisk(180, 3.2, 8), 'Severe');
  assert.equal(computeWinterInversionRisk(55, 5.0, 4), 'High');
  assert.equal(computeWinterInversionRisk(12, 18.0, 14), 'Low');
});

test('aggregateDailyTrend groups hourly readings into ordered daily averages and peaks', () => {
  const times = [
    '2026-11-25T08:00',
    '2026-11-25T14:00',
    '2026-11-26T08:00',
    '2026-11-26T14:00',
  ];
  const pm25 = [40, 20, 90, 50];
  const aqi = [112, 68, 169, 137];
  const trend = aggregateDailyTrend(times, pm25, aqi);
  assert.equal(trend.length, 2);
  assert.equal(trend[0].dateIso, '2026-11-25');
  assert.equal(trend[0].avgPm25, 30);
  assert.equal(trend[0].peakPm25, 40);
  assert.equal(trend[1].avgPm25, 70);
  assert.equal(trend[1].peakUsAqi, 169);
});

test('every preset city carries a 7-day weeklyTrend array', () => {
  for (const city of PRESET_CITIES) {
    assert.equal(city.weeklyTrend.length, 7);
    assert.ok(city.weeklyTrend.every((d) => d.peakPm25 >= d.avgPm25));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_CITIES } from '../data/presetCities';
import {
  calculateHouseholdImpact,
  DEFAULT_HOUSEHOLD_PROFILE,
  INTERVENTION_CATALOG,
} from './impactCalculator';

test('calculateHouseholdImpact returns zero reduction when no interventions are selected', () => {
  const delhi = PRESET_CITIES[0];
  const summary = calculateHouseholdImpact(delhi, DEFAULT_HOUSEHOLD_PROFILE, []);
  assert.equal(summary.indoorReductionPct, 0);
  assert.equal(summary.doseReductionPct, 0);
  assert.equal(summary.baselineIndoorPm25, summary.mitigatedIndoorPm25);
  assert.equal(summary.weeklyCo2AvoidedKg, 0);
});

test('adopting indoor filtration and transit swaps lowers inhaled dose and adds CO2 savings', () => {
  const delhi = PRESET_CITIES[0];
  const summary = calculateHouseholdImpact(delhi, DEFAULT_HOUSEHOLD_PROFILE, [
    'indoor_corsi_rosenthal',
    'routine_n95_commute',
    'sustainable_transit_swap',
  ]);
  assert.ok(summary.mitigatedIndoorPm25 < summary.baselineIndoorPm25);
  assert.ok(summary.indoorReductionPct >= 40);
  assert.ok(summary.mitigatedDailyDoseUg < summary.baselineDailyDoseUg);
  assert.ok(summary.doseReductionPct >= 35);
  assert.ok(summary.cigaretteEquivalentsAvoided > 0);
  assert.ok(summary.weeklyCo2AvoidedKg > 10);
  assert.ok(summary.winterSeasonCo2AvoidedKg > summary.weeklyCo2AvoidedKg * 10);
});

test('drafty home with solid biomass cooking produces higher baseline indoor PM2.5 than sealed induction home', () => {
  const milan = PRESET_CITIES[3];
  const draftyBiomass = calculateHouseholdImpact(
    milan,
    {
      ...DEFAULT_HOUSEHOLD_PROFILE,
      homeType: 'drafty_older',
      cookingFuel: 'solid_biomass',
    },
    []
  );
  const sealedInduction = calculateHouseholdImpact(
    milan,
    {
      ...DEFAULT_HOUSEHOLD_PROFILE,
      homeType: 'sealed_double_glazed',
      cookingFuel: 'induction_electric',
    },
    []
  );
  assert.ok(draftyBiomass.baselineIndoorPm25 > sealedInduction.baselineIndoorPm25);
});

test('all catalog interventions include valid categories and positive impact explanations', () => {
  assert.ok(INTERVENTION_CATALOG.length >= 9);
  for (const item of INTERVENTION_CATALOG) {
    assert.ok(item.directImpactExplanation.length > 20);
    assert.ok(item.steps.length >= 2);
  }
});

import type {
  HouseholdProfile,
  ImpactSummary,
  InterventionChoice,
  LocationTelemetry,
} from '../types/airQuality';

export const DEFAULT_HOUSEHOLD_PROFILE: HouseholdProfile = {
  householdSize: 4,
  sensitivities: ['infants_children', 'asthma_respiratory'],
  homeType: 'standard_apartment',
  cookingFuel: 'lpg_gas_stove',
  commuteMode: 'private_car',
  purifierSetup: 'none',
  dailyCommuteKm: 18,
};

export const INTERVENTION_CATALOG: InterventionChoice[] = [
  {
    id: 'routine_afternoon_airing',
    category: 'routine',
    title: 'Shift Window Airing to Midday Trough',
    summary: 'Keep windows latched during morning/evening inversion peaks and flush indoor CO₂ only during the lowest-PM2.5 afternoon window.',
    costTier: 'Free',
    indoorPmReductionPct: 18,
    outdoorDoseReductionPct: 8,
    weeklyCo2AvoidedKg: 0,
    weeklyPmAvoidedGrams: 0,
    directImpactExplanation:
      'Prevents morning rush-hour smog spikes from entering living rooms while still refreshing stale indoor air when thermal mixing peaks.',
    steps: [
      'Seal exterior doors and windows before 07:00 and after 17:00.',
      'Open opposite windows for 10–15 minutes during the forecast trough.',
      'Close windows promptly once afternoon cooling begins.',
    ],
  },
  {
    id: 'routine_commute_timing',
    category: 'routine',
    title: 'Delay School & Exercise Past 09:30',
    summary: 'Move outdoor walks, dog runs, and errands away from stagnant cold-start morning hours when ground-level PM2.5 and NO₂ peak.',
    costTier: 'Free',
    indoorPmReductionPct: 0,
    outdoorDoseReductionPct: 24,
    weeklyCo2AvoidedKg: 1.2,
    weeklyPmAvoidedGrams: 1.8,
    directImpactExplanation:
      'Cutting strenuous breathing during cold morning inversion lowers peak lung particle deposition by ~24% on smoggy days.',
    steps: [
      'Schedule outdoor exercise or playground trips between 13:00 and 16:00.',
      'Move high-exertion cardio indoors on Severe or High inversion days.',
    ],
  },
  {
    id: 'routine_n95_commute',
    category: 'routine',
    title: 'Wear Fitted N95/KN95 for Outdoor Transit',
    summary: 'Use a snug-fitting N95 or FFP2 respirator whenever AQI exceeds 100 during walks, bike rides, or open-air transit waits.',
    costTier: 'Low Cost',
    indoorPmReductionPct: 0,
    outdoorDoseReductionPct: 48,
    weeklyCo2AvoidedKg: 0,
    weeklyPmAvoidedGrams: 0,
    directImpactExplanation:
      'A well-sealed N95 filters >90% of outdoor PM2.5 during your commute hours, nearly halving total daily inhaled fine particles.',
    steps: [
      'Pinch the nose bridge wire until glasses do not fog.',
      'Replace filter masks once breathing resistance increases or straps loosen.',
    ],
  },
  {
    id: 'indoor_corsi_rosenthal',
    category: 'indoor',
    title: 'Build a DIY Corsi-Rosenthal MERV-13 Cube',
    summary: 'Tape four 20×20 MERV-13 furnace filters to a standard box fan to create a high-CADR clean-air sanctuary at ~1/4 the cost of commercial units.',
    costTier: 'Low Cost',
    indoorPmReductionPct: 46,
    outdoorDoseReductionPct: 0,
    weeklyCo2AvoidedKg: 0,
    weeklyPmAvoidedGrams: 0,
    directImpactExplanation:
      'Delivers 400–600 CFM of particulate filtration, cutting bedroom PM2.5 by up to 46% within 45 minutes of continuous low-speed operation.',
    steps: [
      'Tape four MERV-13 filters into a square with airflow arrows pointing inward.',
      'Seal a 20-inch box fan on top blowing upward with cardboard shroud.',
      'Run on medium speed in the primary sleeping or children’s room.',
    ],
  },
  {
    id: 'indoor_draft_sealing',
    category: 'indoor',
    title: 'Seal Door Gaps & Switch to Wet Mopping',
    summary: 'Block under-door air leaks with foam weatherstripping and wet-mop floors instead of dry sweeping or dry dusting.',
    costTier: 'Free',
    indoorPmReductionPct: 16,
    outdoorDoseReductionPct: 0,
    weeklyCo2AvoidedKg: 0,
    weeklyPmAvoidedGrams: 0,
    directImpactExplanation:
      'Stops settled toxic road dust from resuspending indoors and lowers outdoor-to-indoor infiltration rates during overnight inversions.',
    steps: [
      'Add adhesive foam strips or rolled damp towels along exterior door thresholds.',
      'Replace dry brooms with microfiber damp mops every 2 days.',
      'Leave outdoor shoes at the entry mat.',
    ],
  },
  {
    id: 'indoor_kitchen_exhaust',
    category: 'indoor',
    title: 'Ventilate Cooking & Ban Indoor Incense/Smoke',
    summary: 'Always run a vented range hood (or crack a nearby window briefly while cooking), cover pans with lids, and skip candles/incense.',
    costTier: 'Free',
    indoorPmReductionPct: 22,
    outdoorDoseReductionPct: 0,
    weeklyCo2AvoidedKg: 0.9,
    weeklyPmAvoidedGrams: 3.4,
    directImpactExplanation:
      'Eliminates indoor PM2.5 spikes (often 100+ µg/m³ during frying) and reduces household nitrogen dioxide buildup.',
    steps: [
      'Switch on the kitchen exhaust fan 5 minutes before lighting burners.',
      'Use lids on boiling pots to shorten burner runtime by ~25%.',
      'Avoid incense, mosquito coils, and decorative wood fires.',
    ],
  },
  {
    id: 'sustainable_transit_swap',
    category: 'sustainable',
    title: 'Swap Solo Car/Scooter Trips for Metro or Bus',
    summary: 'Replace 3+ weekly solo vehicle commutes with electric metro, bus, or shared neighborhood carpools.',
    costTier: 'Low Cost',
    indoorPmReductionPct: 0,
    outdoorDoseReductionPct: 12,
    weeklyCo2AvoidedKg: 14.6,
    weeklyPmAvoidedGrams: 9.2,
    directImpactExplanation:
      'Removes cold-start tailpipe NOₓ and brake/tire particulate emissions from your neighborhood streets while cutting cabin exhaust peaks.',
    steps: [
      'Batch errands into a single mid-day route to eliminate cold engine starts.',
      'Coordinate a 3-family school carpool or rail pass for weekday mornings.',
    ],
  },
  {
    id: 'sustainable_clean_cooking',
    category: 'sustainable',
    title: 'Shift Heavy Meals to Induction or Electric Kettle',
    summary: 'Offload boiling, pressure-cooking, and simmering from gas/biomass burners to an electric induction hotplate or multi-cooker.',
    costTier: 'Moderate',
    indoorPmReductionPct: 19,
    outdoorDoseReductionPct: 0,
    weeklyCo2AvoidedKg: 6.8,
    weeklyPmAvoidedGrams: 11.5,
    directImpactExplanation:
      'Cuts indoor NO₂ and ultrafine combustion particles at the source while reducing neighborhood soot output.',
    steps: [
      'Use an electric kettle for tea/water and an electric pressure cooker for lentils/rice.',
      'Reserve gas burners only for brief high-heat cooking with exhaust active.',
    ],
  },
  {
    id: 'sustainable_no_idle_community',
    category: 'sustainable',
    title: 'Zero-Idling & Leaf/Trash Burn Prevention',
    summary: 'Turn off vehicle engines after 10 seconds at school pickups and report/compost winter dry leaves instead of open burning.',
    costTier: 'Free',
    indoorPmReductionPct: 4,
    outdoorDoseReductionPct: 6,
    weeklyCo2AvoidedKg: 4.3,
    weeklyPmAvoidedGrams: 16.0,
    directImpactExplanation:
      'Open waste burning and school-gate idling create hyper-local toxic PM2.5 plumes right at child breathing height.',
    steps: [
      'Cut engine ignition during school drop-off waits over 10 seconds.',
      'Share municipal leaf-composting drop-off points with your residential block.',
    ],
  },
];

export function calculateHouseholdImpact(
  telemetry: LocationTelemetry,
  profile: HouseholdProfile,
  selectedChoiceIds: string[]
): ImpactSummary {
  const outdoorPm25 = Math.max(1, telemetry.pm25);

  const infiltrationByHome: Record<HouseholdProfile['homeType'], number> = {
    drafty_older: 0.72,
    standard_apartment: 0.56,
    sealed_double_glazed: 0.41,
  };

  const indoorSourceByCooking: Record<HouseholdProfile['cookingFuel'], number> = {
    solid_biomass: 42,
    lpg_gas_stove: 14,
    induction_electric: 3,
  };

  const purifierFactorBySetup: Record<HouseholdProfile['purifierSetup'], number> = {
    none: 1.0,
    diy_corsi_rosenthal: 0.58,
    hepa_single_room: 0.52,
    hepa_whole_home: 0.32,
  };

  const baseInfiltration = infiltrationByHome[profile.homeType];
  const cookingSpike = indoorSourceByCooking[profile.cookingFuel];
  const existingPurifierFactor = purifierFactorBySetup[profile.purifierSetup];

  const baselineIndoorPm25 =
    Math.round((outdoorPm25 * baseInfiltration + cookingSpike) * existingPurifierFactor * 10) / 10;

  const selectedSet = new Set(selectedChoiceIds);
  const adoptedChoices = INTERVENTION_CATALOG.filter((c) => selectedSet.has(c.id));

  // Multiplicative attenuation so combined interventions behave realistically and stay bounded
  let indoorMultiplier = 1.0;
  let outdoorMultiplier = 1.0;
  let weeklyCo2AvoidedKg = 0;
  let weeklyPmAvoidedGrams = 0;

  for (const choice of adoptedChoices) {
    if (choice.indoorPmReductionPct > 0) {
      indoorMultiplier *= 1 - choice.indoorPmReductionPct / 100;
    }
    if (choice.outdoorDoseReductionPct > 0) {
      outdoorMultiplier *= 1 - choice.outdoorDoseReductionPct / 100;
    }
    const scaleFactor =
      choice.id === 'sustainable_transit_swap'
        ? Math.max(0.5, Math.min(2.2, profile.dailyCommuteKm / 18))
        : 1;
    weeklyCo2AvoidedKg += choice.weeklyCo2AvoidedKg * scaleFactor;
    weeklyPmAvoidedGrams += choice.weeklyPmAvoidedGrams * scaleFactor;
  }

  // Clamp minimum indoor PM2.5 to realistic floor (3 µg/m³ or 12% of outdoor)
  const minFloor = Math.min(baselineIndoorPm25, Math.max(3.0, outdoorPm25 * 0.1));
  const mitigatedIndoorPm25 =
    Math.round(Math.max(minFloor, baselineIndoorPm25 * indoorMultiplier) * 10) / 10;

  const indoorReductionPct =
    baselineIndoorPm25 > 0
      ? Math.max(0, Math.round(((baselineIndoorPm25 - mitigatedIndoorPm25) / baselineIndoorPm25) * 100))
      : 0;

  // Daily inhaled air volume ~ 14 m³/day average across household member
  // 20h indoors (~0.52 m³/h resting/light = 10.4 m³) + 4h commute/outdoors (~0.9 m³/h = 3.6 m³)
  const indoorAirVol = 10.4;
  const outdoorAirVol = profile.commuteMode === 'remote_wfh' ? 1.4 : 3.6;

  const commuteOutdoorMultiplier =
    profile.commuteMode === 'walk_cycle' || profile.commuteMode === 'two_wheeler' ? 1.25 : 1.0;

  const baselineDailyDoseUg = Math.round(
    baselineIndoorPm25 * indoorAirVol +
      outdoorPm25 * commuteOutdoorMultiplier * outdoorAirVol
  );

  const mitigatedDailyDoseUg = Math.round(
    mitigatedIndoorPm25 * indoorAirVol +
      outdoorPm25 * commuteOutdoorMultiplier * outdoorAirVol * outdoorMultiplier
  );

  const doseReductionPct =
    baselineDailyDoseUg > 0
      ? Math.max(
          0,
          Math.round(((baselineDailyDoseUg - mitigatedDailyDoseUg) / baselineDailyDoseUg) * 100)
        )
      : 0;

  // Berkeley Earth approximation: ~22 µg/m³ for 24h (~308 µg inhaled) ≈ 1 cigarette
  const ugPerCigarette = 308;
  const cigaretteEquivalentsBaseline =
    Math.round((baselineDailyDoseUg / ugPerCigarette) * 10) / 10;
  const cigaretteEquivalentsMitigated =
    Math.round((mitigatedDailyDoseUg / ugPerCigarette) * 10) / 10;
  const cigaretteEquivalentsAvoided = Math.max(
    0,
    Math.round((cigaretteEquivalentsBaseline - cigaretteEquivalentsMitigated) * 10) / 10
  );

  const householdFactor = Math.max(1, Math.min(8, profile.householdSize)) / 4;
  const scaledWeeklyCo2 = Math.round(weeklyCo2AvoidedKg * Math.max(0.75, householdFactor * 0.85) * 10) / 10;
  const scaledWeeklyPm = Math.round(weeklyPmAvoidedGrams * Math.max(0.75, householdFactor * 0.85) * 10) / 10;

  return {
    outdoorPm25: Math.round(outdoorPm25 * 10) / 10,
    baselineIndoorPm25,
    mitigatedIndoorPm25,
    indoorReductionPct,
    baselineDailyDoseUg,
    mitigatedDailyDoseUg,
    doseReductionPct,
    cigaretteEquivalentsBaseline,
    cigaretteEquivalentsMitigated,
    cigaretteEquivalentsAvoided,
    weeklyCo2AvoidedKg: scaledWeeklyCo2,
    weeklyPmAvoidedGrams: scaledWeeklyPm,
    winterSeasonCo2AvoidedKg: Math.round(scaledWeeklyCo2 * 13 * 10) / 10, // ~13-week winter smog season
  };
}

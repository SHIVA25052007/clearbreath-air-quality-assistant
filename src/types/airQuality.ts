export type AqiSeverityLevel =
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

export interface AqiCategoryInfo {
  level: AqiSeverityLevel;
  label: string;
  shortLabel: string;
  symbol: string;
  textColorClass: string;
  borderColorClass: string;
  barColorHex: string;
  guidance: string;
}

export interface HourlyForecastPoint {
  timeIso: string;
  hourLabel: string;
  pm25: number;
  pm10: number;
  usAqi: number;
  windKmh: number;
  tempC: number;
}

export interface DailyTrendPoint {
  dateIso: string;
  dayLabel: string;
  shortDate: string;
  avgPm25: number;
  peakPm25: number;
  avgUsAqi: number;
  peakUsAqi: number;
}

export interface LocationTelemetry {
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  observedAtIso: string;
  usAqi: number;
  europeanAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  o3: number;
  coUgM3: number;
  tempC: number;
  windKmh: number;
  humidityPct: number;
  inversionRisk: 'Low' | 'Moderate' | 'High' | 'Severe';
  hourly: HourlyForecastPoint[];
  weeklyTrend: DailyTrendPoint[];
  dataSource: 'live' | 'preset';
  estimatedFields?: string[];
}

export type HomeEnclosureType =
  | 'drafty_older'
  | 'standard_apartment'
  | 'sealed_double_glazed';

export type CookingFuelType = 'solid_biomass' | 'lpg_gas_stove' | 'induction_electric';

export type CommuteModeType =
  | 'private_car'
  | 'two_wheeler'
  | 'public_transit'
  | 'walk_cycle'
  | 'remote_wfh';

export type PurifierSetupType = 'none' | 'diy_corsi_rosenthal' | 'hepa_single_room' | 'hepa_whole_home';

export type SensitivityGroup =
  | 'infants_children'
  | 'elderly_seniors'
  | 'asthma_respiratory'
  | 'outdoor_athletes';

export interface HouseholdProfile {
  householdSize: number;
  sensitivities: SensitivityGroup[];
  homeType: HomeEnclosureType;
  cookingFuel: CookingFuelType;
  commuteMode: CommuteModeType;
  purifierSetup: PurifierSetupType;
  dailyCommuteKm: number;
}

export type InterventionCategory = 'routine' | 'indoor' | 'sustainable';

export interface InterventionChoice {
  id: string;
  category: InterventionCategory;
  title: string;
  summary: string;
  costTier: 'Free' | 'Low Cost' | 'Moderate';
  indoorPmReductionPct: number;
  outdoorDoseReductionPct: number;
  weeklyCo2AvoidedKg: number;
  weeklyPmAvoidedGrams: number;
  directImpactExplanation: string;
  steps: string[];
}

export interface ImpactSummary {
  outdoorPm25: number;
  baselineIndoorPm25: number;
  mitigatedIndoorPm25: number;
  indoorReductionPct: number;
  baselineDailyDoseUg: number;
  mitigatedDailyDoseUg: number;
  doseReductionPct: number;
  cigaretteEquivalentsBaseline: number;
  cigaretteEquivalentsMitigated: number;
  cigaretteEquivalentsAvoided: number;
  weeklyCo2AvoidedKg: number;
  weeklyPmAvoidedGrams: number;
  winterSeasonCo2AvoidedKg: number;
}

export interface VentilationWindow {
  startLabel: string;
  endLabel: string;
  avgPm25: number;
  avgUsAqi: number;
  reason: string;
}

export interface AiPlanItem {
  title: string;
  timingOrLocation: string;
  actionSteps: string;
  directImpact: string;
}

export interface AiActionPlan {
  headline: string;
  smogRiskSummary: string;
  cleanestVentilationWindow: string;
  routines: AiPlanItem[];
  indoorHacks: AiPlanItem[];
  sustainableAlternatives: AiPlanItem[];
  communityNotice: string;
  generatedAt: string;
  model: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

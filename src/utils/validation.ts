import type {
  CommuteModeType,
  CookingFuelType,
  DailyTrendPoint,
  HomeEnclosureType,
  HouseholdProfile,
  HourlyForecastPoint,
  ImpactSummary,
  LocationTelemetry,
  PurifierSetupType,
  SensitivityGroup,
} from '../types/airQuality';

const HOME_TYPES = new Set<HomeEnclosureType>([
  'drafty_older',
  'standard_apartment',
  'sealed_double_glazed',
]);

const COOKING_FUELS = new Set<CookingFuelType>([
  'solid_biomass',
  'lpg_gas_stove',
  'induction_electric',
]);

const COMMUTE_MODES = new Set<CommuteModeType>([
  'private_car',
  'two_wheeler',
  'public_transit',
  'walk_cycle',
  'remote_wfh',
]);

const PURIFIER_SETUPS = new Set<PurifierSetupType>([
  'none',
  'diy_corsi_rosenthal',
  'hepa_single_room',
  'hepa_whole_home',
]);

const SENSITIVITY_GROUPS = new Set<SensitivityGroup>([
  'infants_children',
  'elderly_seniors',
  'asthma_respiratory',
  'outdoor_athletes',
]);

const INVERSION_RISKS = new Set<LocationTelemetry['inversionRisk']>([
  'Low',
  'Moderate',
  'High',
  'Severe',
]);

const DATA_SOURCES = new Set<LocationTelemetry['dataSource']>(['live', 'preset']);

const SAFE_GEO_LABEL_REGEX = /^[\p{L}\p{N}\s,.'\-/()]*$/u;
const SAFE_TIMEZONE_REGEX = /^[A-Za-z0-9_/+:-]+$/;
const ISO_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ESTIMATED_FIELD_REGEX = /^[a-zA-Z0-9_.\-\s]{1,32}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function sanitizeTextInput(raw: unknown, maxLength = 120): string {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function validateCityQuery(raw: unknown): {
  valid: boolean;
  city: string;
  error?: string;
} {
  const cleaned = sanitizeTextInput(raw, 80);
  if (cleaned.length < 2) {
    return {
      valid: false,
      city: '',
      error: 'Please enter at least 2 characters for a city or neighborhood name.',
    };
  }
  if (!/^[\p{L}\p{N}\s,.'-]+$/u.test(cleaned)) {
    return {
      valid: false,
      city: '',
      error: 'City name contains unsupported characters.',
    };
  }
  return { valid: true, city: cleaned };
}

export function validateCoordinates(
  latRaw: unknown,
  lonRaw: unknown
): { valid: boolean; lat: number; lon: number; error?: string } {
  const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
  const lon = typeof lonRaw === 'number' ? lonRaw : Number(lonRaw);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { valid: false, lat: 0, lon: 0, error: 'Coordinates must be valid numbers.' };
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return {
      valid: false,
      lat: 0,
      lon: 0,
      error: 'Coordinates out of geographic range.',
    };
  }
  return { valid: true, lat, lon };
}

export function validateChatMessage(raw: unknown): {
  valid: boolean;
  message: string;
  error?: string;
} {
  const cleaned = sanitizeTextInput(raw, 600);
  if (cleaned.length < 2) {
    return {
      valid: false,
      message: '',
      error: 'Please enter a question or prompt (at least 2 characters).',
    };
  }
  return { valid: true, message: cleaned };
}

export function validateHouseholdProfile(
  raw: unknown
): { valid: true; profile: HouseholdProfile } | { valid: false; error: string } {
  if (!isPlainObject(raw)) {
    return { valid: false, error: 'Household profile must be a JSON object.' };
  }

  if (!isFiniteInRange(raw.householdSize, 1, 20) || !Number.isInteger(raw.householdSize)) {
    return { valid: false, error: 'profile.householdSize must be an integer between 1 and 20.' };
  }

  if (!Array.isArray(raw.sensitivities) || raw.sensitivities.length > 10) {
    return { valid: false, error: 'profile.sensitivities must be an array.' };
  }
  const sensitivities: SensitivityGroup[] = [];
  for (const item of raw.sensitivities) {
    if (typeof item !== 'string' || !SENSITIVITY_GROUPS.has(item as SensitivityGroup)) {
      return { valid: false, error: 'profile.sensitivities contains an unsupported value.' };
    }
    if (!sensitivities.includes(item as SensitivityGroup)) {
      sensitivities.push(item as SensitivityGroup);
    }
  }

  if (typeof raw.homeType !== 'string' || !HOME_TYPES.has(raw.homeType as HomeEnclosureType)) {
    return { valid: false, error: 'profile.homeType is invalid.' };
  }

  if (
    typeof raw.cookingFuel !== 'string' ||
    !COOKING_FUELS.has(raw.cookingFuel as CookingFuelType)
  ) {
    return { valid: false, error: 'profile.cookingFuel is invalid.' };
  }

  if (
    typeof raw.commuteMode !== 'string' ||
    !COMMUTE_MODES.has(raw.commuteMode as CommuteModeType)
  ) {
    return { valid: false, error: 'profile.commuteMode is invalid.' };
  }

  if (
    typeof raw.purifierSetup !== 'string' ||
    !PURIFIER_SETUPS.has(raw.purifierSetup as PurifierSetupType)
  ) {
    return { valid: false, error: 'profile.purifierSetup is invalid.' };
  }

  if (!isFiniteInRange(raw.dailyCommuteKm, 0, 500)) {
    return { valid: false, error: 'profile.dailyCommuteKm must be a number between 0 and 500.' };
  }

  return {
    valid: true,
    profile: {
      householdSize: raw.householdSize,
      sensitivities,
      homeType: raw.homeType as HomeEnclosureType,
      cookingFuel: raw.cookingFuel as CookingFuelType,
      commuteMode: raw.commuteMode as CommuteModeType,
      purifierSetup: raw.purifierSetup as PurifierSetupType,
      dailyCommuteKm: raw.dailyCommuteKm,
    },
  };
}

export function validateLocationTelemetry(
  raw: unknown
): { valid: true; telemetry: LocationTelemetry } | { valid: false; error: string } {
  if (!isPlainObject(raw)) {
    return { valid: false, error: 'Telemetry must be a JSON object.' };
  }

  if (typeof raw.city !== 'string') {
    return { valid: false, error: 'telemetry.city must be a string.' };
  }
  const city = sanitizeTextInput(raw.city, 80);
  if (city.length < 1 || !SAFE_GEO_LABEL_REGEX.test(city)) {
    return { valid: false, error: 'telemetry.city is required and must be a valid place name.' };
  }

  if (typeof raw.region !== 'string' || typeof raw.country !== 'string') {
    return { valid: false, error: 'telemetry.region and telemetry.country must be strings.' };
  }
  const region = sanitizeTextInput(raw.region, 80);
  const country = sanitizeTextInput(raw.country, 80);
  if (!SAFE_GEO_LABEL_REGEX.test(region) || !SAFE_GEO_LABEL_REGEX.test(country)) {
    return { valid: false, error: 'telemetry.region or telemetry.country contains unsupported characters.' };
  }

  if (!isFiniteInRange(raw.latitude, -90, 90) || !isFiniteInRange(raw.longitude, -180, 180)) {
    return { valid: false, error: 'telemetry coordinates are invalid.' };
  }

  if (typeof raw.timezone !== 'string' || typeof raw.observedAtIso !== 'string') {
    return { valid: false, error: 'telemetry.timezone and telemetry.observedAtIso must be strings.' };
  }
  const timezone = sanitizeTextInput(raw.timezone, 64);
  const observedAtIso = sanitizeTextInput(raw.observedAtIso, 40);
  if (
    !timezone ||
    !SAFE_TIMEZONE_REGEX.test(timezone) ||
    !observedAtIso ||
    !ISO_DATETIME_REGEX.test(observedAtIso)
  ) {
    return { valid: false, error: 'telemetry.timezone and telemetry.observedAtIso must be valid.' };
  }

  if (
    !isFiniteInRange(raw.usAqi, 0, 1000) ||
    !isFiniteInRange(raw.europeanAqi, 0, 1000) ||
    !isFiniteInRange(raw.pm25, 0, 2000) ||
    !isFiniteInRange(raw.pm10, 0, 5000) ||
    !isFiniteInRange(raw.no2, 0, 2000) ||
    !isFiniteInRange(raw.so2, 0, 2000) ||
    !isFiniteInRange(raw.o3, 0, 2000) ||
    !isFiniteInRange(raw.coUgM3, 0, 100000) ||
    !isFiniteInRange(raw.tempC, -90, 70) ||
    !isFiniteInRange(raw.windKmh, 0, 400) ||
    !isFiniteInRange(raw.humidityPct, 0, 100)
  ) {
    return { valid: false, error: 'telemetry numeric measurements are missing or out of range.' };
  }

  if (
    typeof raw.inversionRisk !== 'string' ||
    !INVERSION_RISKS.has(raw.inversionRisk as LocationTelemetry['inversionRisk'])
  ) {
    return { valid: false, error: 'telemetry.inversionRisk is invalid.' };
  }

  if (
    typeof raw.dataSource !== 'string' ||
    !DATA_SOURCES.has(raw.dataSource as LocationTelemetry['dataSource'])
  ) {
    return { valid: false, error: 'telemetry.dataSource is invalid.' };
  }

  if (!Array.isArray(raw.hourly) || raw.hourly.length === 0 || raw.hourly.length > 48) {
    return { valid: false, error: 'telemetry.hourly must be an array with 1 to 48 entries.' };
  }

  const hourly: HourlyForecastPoint[] = [];
  for (const pt of raw.hourly) {
    if (!isPlainObject(pt)) {
      return { valid: false, error: 'telemetry.hourly contains an invalid entry.' };
    }
    if (typeof pt.timeIso !== 'string' || typeof pt.hourLabel !== 'string') {
      return { valid: false, error: 'telemetry.hourly timestamps must be strings.' };
    }
    const timeIso = sanitizeTextInput(pt.timeIso, 40);
    const hourLabel = sanitizeTextInput(pt.hourLabel, 16);
    if (!timeIso || !ISO_DATETIME_REGEX.test(timeIso) || !hourLabel) {
      return { valid: false, error: 'telemetry.hourly entries require valid timeIso and hourLabel.' };
    }
    if (
      !isFiniteInRange(pt.pm25, 0, 2000) ||
      !isFiniteInRange(pt.pm10, 0, 5000) ||
      !isFiniteInRange(pt.usAqi, 0, 1000) ||
      !isFiniteInRange(pt.windKmh, 0, 400) ||
      !isFiniteInRange(pt.tempC, -90, 70)
    ) {
      return { valid: false, error: 'telemetry.hourly contains out-of-range measurements.' };
    }
    hourly.push({
      timeIso,
      hourLabel,
      pm25: pt.pm25,
      pm10: pt.pm10,
      usAqi: pt.usAqi,
      windKmh: pt.windKmh,
      tempC: pt.tempC,
    });
  }

  if (!Array.isArray(raw.weeklyTrend) || raw.weeklyTrend.length === 0 || raw.weeklyTrend.length > 14) {
    return { valid: false, error: 'telemetry.weeklyTrend must be an array with 1 to 14 entries.' };
  }

  const weeklyTrend: DailyTrendPoint[] = [];
  for (const day of raw.weeklyTrend) {
    if (!isPlainObject(day)) {
      return { valid: false, error: 'telemetry.weeklyTrend contains an invalid entry.' };
    }
    if (
      typeof day.dateIso !== 'string' ||
      typeof day.dayLabel !== 'string' ||
      typeof day.shortDate !== 'string'
    ) {
      return { valid: false, error: 'telemetry.weeklyTrend labels must be strings.' };
    }
    const dateIso = sanitizeTextInput(day.dateIso, 20);
    const dayLabel = sanitizeTextInput(day.dayLabel, 16);
    const shortDate = sanitizeTextInput(day.shortDate, 20);
    if (!dateIso || !ISO_DATE_REGEX.test(dateIso) || !dayLabel || !shortDate) {
      return { valid: false, error: 'telemetry.weeklyTrend entries require valid date labels.' };
    }
    if (
      !isFiniteInRange(day.avgPm25, 0, 2000) ||
      !isFiniteInRange(day.peakPm25, 0, 2000) ||
      !isFiniteInRange(day.avgUsAqi, 0, 1000) ||
      !isFiniteInRange(day.peakUsAqi, 0, 1000)
    ) {
      return { valid: false, error: 'telemetry.weeklyTrend contains out-of-range values.' };
    }
    weeklyTrend.push({
      dateIso,
      dayLabel,
      shortDate,
      avgPm25: day.avgPm25,
      peakPm25: day.peakPm25,
      avgUsAqi: day.avgUsAqi,
      peakUsAqi: day.peakUsAqi,
    });
  }

  let estimatedFields: string[] | undefined;
  if (raw.estimatedFields !== undefined) {
    if (!Array.isArray(raw.estimatedFields) || raw.estimatedFields.length > 15) {
      return { valid: false, error: 'telemetry.estimatedFields must be an array of at most 15 items.' };
    }
    const sanitizedFields: string[] = [];
    for (const field of raw.estimatedFields) {
      if (typeof field !== 'string') {
        return { valid: false, error: 'telemetry.estimatedFields must contain only strings.' };
      }
      const cleanedField = sanitizeTextInput(field, 32);
      if (!cleanedField || !SAFE_ESTIMATED_FIELD_REGEX.test(cleanedField)) {
        return { valid: false, error: 'telemetry.estimatedFields contains an invalid label.' };
      }
      sanitizedFields.push(cleanedField);
    }
    estimatedFields = sanitizedFields;
  }

  return {
    valid: true,
    telemetry: {
      city,
      region,
      country,
      latitude: raw.latitude,
      longitude: raw.longitude,
      timezone,
      observedAtIso,
      usAqi: raw.usAqi,
      europeanAqi: raw.europeanAqi,
      pm25: raw.pm25,
      pm10: raw.pm10,
      no2: raw.no2,
      so2: raw.so2,
      o3: raw.o3,
      coUgM3: raw.coUgM3,
      tempC: raw.tempC,
      windKmh: raw.windKmh,
      humidityPct: raw.humidityPct,
      inversionRisk: raw.inversionRisk as LocationTelemetry['inversionRisk'],
      hourly,
      weeklyTrend,
      dataSource: raw.dataSource as LocationTelemetry['dataSource'],
      ...(estimatedFields && estimatedFields.length > 0 ? { estimatedFields } : {}),
    },
  };
}

export function validateImpactSummary(
  raw: unknown
): { valid: true; impact: ImpactSummary } | { valid: false; error: string } {
  if (!isPlainObject(raw)) {
    return { valid: false, error: 'Impact summary must be a JSON object.' };
  }

  if (
    !isFiniteInRange(raw.outdoorPm25, 0, 2000) ||
    !isFiniteInRange(raw.baselineIndoorPm25, 0, 2000) ||
    !isFiniteInRange(raw.mitigatedIndoorPm25, 0, 2000) ||
    !isFiniteInRange(raw.indoorReductionPct, 0, 100) ||
    !isFiniteInRange(raw.baselineDailyDoseUg, 0, 100000) ||
    !isFiniteInRange(raw.mitigatedDailyDoseUg, 0, 100000) ||
    !isFiniteInRange(raw.doseReductionPct, 0, 100) ||
    !isFiniteInRange(raw.cigaretteEquivalentsBaseline, 0, 500) ||
    !isFiniteInRange(raw.cigaretteEquivalentsMitigated, 0, 500) ||
    !isFiniteInRange(raw.cigaretteEquivalentsAvoided, 0, 500) ||
    !isFiniteInRange(raw.weeklyCo2AvoidedKg, 0, 5000) ||
    !isFiniteInRange(raw.weeklyPmAvoidedGrams, 0, 5000) ||
    !isFiniteInRange(raw.winterSeasonCo2AvoidedKg, 0, 100000)
  ) {
    return { valid: false, error: 'impact metrics are missing or out of valid range.' };
  }

  return {
    valid: true,
    impact: {
      outdoorPm25: raw.outdoorPm25,
      baselineIndoorPm25: raw.baselineIndoorPm25,
      mitigatedIndoorPm25: raw.mitigatedIndoorPm25,
      indoorReductionPct: raw.indoorReductionPct,
      baselineDailyDoseUg: raw.baselineDailyDoseUg,
      mitigatedDailyDoseUg: raw.mitigatedDailyDoseUg,
      doseReductionPct: raw.doseReductionPct,
      cigaretteEquivalentsBaseline: raw.cigaretteEquivalentsBaseline,
      cigaretteEquivalentsMitigated: raw.cigaretteEquivalentsMitigated,
      cigaretteEquivalentsAvoided: raw.cigaretteEquivalentsAvoided,
      weeklyCo2AvoidedKg: raw.weeklyCo2AvoidedKg,
      weeklyPmAvoidedGrams: raw.weeklyPmAvoidedGrams,
      winterSeasonCo2AvoidedKg: raw.winterSeasonCo2AvoidedKg,
    },
  };
}

function validateAssistantContext(
  raw: Record<string, unknown>
):
  | {
      valid: true;
      telemetry: LocationTelemetry;
      profile: HouseholdProfile;
      impact: ImpactSummary;
    }
  | { valid: false; error: string } {
  const telemetryCheck = validateLocationTelemetry(raw.telemetry);
  if (!telemetryCheck.valid) {
    return telemetryCheck;
  }

  const profileCheck = validateHouseholdProfile(raw.profile);
  if (!profileCheck.valid) {
    return profileCheck;
  }

  const impactCheck = validateImpactSummary(raw.impact);
  if (!impactCheck.valid) {
    return impactCheck;
  }

  return {
    valid: true,
    telemetry: telemetryCheck.telemetry,
    profile: profileCheck.profile,
    impact: impactCheck.impact,
  };
}

export function validateAssistantPlanRequest(
  raw: unknown
):
  | {
      valid: true;
      telemetry: LocationTelemetry;
      profile: HouseholdProfile;
      impact: ImpactSummary;
      adoptedTitles: string[];
    }
  | { valid: false; error: string } {
  if (!isPlainObject(raw)) {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }

  const contextCheck = validateAssistantContext(raw);
  if (!contextCheck.valid) {
    return contextCheck;
  }

  let adoptedTitles: string[] = [];
  if (raw.adoptedTitles !== undefined) {
    if (!Array.isArray(raw.adoptedTitles) || raw.adoptedTitles.length > 20) {
      return { valid: false, error: 'adoptedTitles must be an array of at most 20 strings.' };
    }
    const sanitized: string[] = [];
    for (const title of raw.adoptedTitles) {
      if (typeof title !== 'string') {
        return { valid: false, error: 'adoptedTitles must contain only strings.' };
      }
      const cleaned = sanitizeTextInput(title, 80);
      if (cleaned) {
        sanitized.push(cleaned);
      }
    }
    adoptedTitles = sanitized;
  }

  return {
    valid: true,
    telemetry: contextCheck.telemetry,
    profile: contextCheck.profile,
    impact: contextCheck.impact,
    adoptedTitles,
  };
}

export function validateAssistantChatRequest(
  raw: unknown
):
  | {
      valid: true;
      message: string;
      history: Array<{ role: 'Assistant' | 'Family'; text: string }>;
      telemetry: LocationTelemetry;
      profile: HouseholdProfile;
      impact: ImpactSummary;
    }
  | { valid: false; error: string } {
  if (!isPlainObject(raw)) {
    return { valid: false, error: 'Request body must be a JSON object.' };
  }

  const msgCheck = validateChatMessage(raw.message);
  if (!msgCheck.valid) {
    return { valid: false, error: msgCheck.error ?? 'Invalid message.' };
  }

  const contextCheck = validateAssistantContext(raw);
  if (!contextCheck.valid) {
    return contextCheck;
  }

  const history: Array<{ role: 'Assistant' | 'Family'; text: string }> = [];
  if (raw.history !== undefined) {
    if (!Array.isArray(raw.history) || raw.history.length > 20) {
      return { valid: false, error: 'history must be an array of at most 20 entries.' };
    }
    for (const entry of raw.history.slice(-6)) {
      if (!isPlainObject(entry)) {
        return { valid: false, error: 'history contains an invalid entry.' };
      }
      if (entry.role !== 'user' && entry.role !== 'assistant') {
        return { valid: false, error: 'history entry role must be "user" or "assistant".' };
      }
      if (typeof entry.text !== 'string') {
        return { valid: false, error: 'history entry text must be a string.' };
      }
      const cleanedText = sanitizeTextInput(entry.text, 500);
      if (cleanedText) {
        history.push({
          role: entry.role === 'assistant' ? 'Assistant' : 'Family',
          text: cleanedText,
        });
      }
    }
  }

  return {
    valid: true,
    message: msgCheck.message,
    history,
    telemetry: contextCheck.telemetry,
    profile: contextCheck.profile,
    impact: contextCheck.impact,
  };
}

import type {
  AqiCategoryInfo,
  DailyTrendPoint,
  HourlyForecastPoint,
  LocationTelemetry,
  VentilationWindow,
} from '../types/airQuality';

export function getAqiCategory(usAqi: number): AqiCategoryInfo {
  const safeAqi = Number.isFinite(usAqi) ? Math.max(0, Math.round(usAqi)) : 0;

  if (safeAqi <= 50) {
    return {
      level: 'good',
      label: 'Good',
      shortLabel: 'Good',
      symbol: '●',
      textColorClass: 'text-emerald-700',
      borderColorClass: 'border-emerald-200',
      barColorHex: '#15803d',
      guidance: 'Air quality is satisfactory. Normal outdoor routines and cross-ventilation are safe.',
    };
  }
  if (safeAqi <= 100) {
    return {
      level: 'moderate',
      label: 'Moderate',
      shortLabel: 'Moderate',
      symbol: '◐',
      textColorClass: 'text-amber-700',
      borderColorClass: 'border-amber-200',
      barColorHex: '#a16207',
      guidance: 'Sensitive individuals should limit prolonged heavy outdoor exertion near traffic corridors.',
    };
  }
  if (safeAqi <= 150) {
    return {
      level: 'sensitive',
      label: 'Unhealthy for Sensitive Groups',
      shortLabel: 'Sensitive Alert',
      symbol: '▲',
      textColorClass: 'text-orange-700',
      borderColorClass: 'border-orange-200',
      barColorHex: '#c2410c',
      guidance: 'Children, seniors, and anyone with asthma should wear N95 masks outdoors and avoid morning peak smog.',
    };
  }
  if (safeAqi <= 200) {
    return {
      level: 'unhealthy',
      label: 'Unhealthy',
      shortLabel: 'Unhealthy',
      symbol: '■',
      textColorClass: 'text-red-700',
      borderColorClass: 'border-red-200',
      barColorHex: '#b91c1c',
      guidance: 'Keep windows sealed during peak inversion hours, run indoor HEPA filtration, and shift commutes to enclosed transit.',
    };
  }
  if (safeAqi <= 300) {
    return {
      level: 'very_unhealthy',
      label: 'Very Unhealthy',
      shortLabel: 'Very Unhealthy',
      symbol: '◆',
      textColorClass: 'text-purple-800',
      borderColorClass: 'border-purple-200',
      barColorHex: '#6b21a8',
      guidance: 'Severe smog episode. Move exercise indoors, seal door drafts, use fitted N95/KN95 respirators outside.',
    };
  }
  return {
    level: 'hazardous',
    label: 'Hazardous',
    shortLabel: 'Hazardous',
    symbol: '✖',
    textColorClass: 'text-rose-900',
    borderColorClass: 'border-rose-300',
    barColorHex: '#881337',
    guidance: 'Emergency pollution levels. Minimize outdoor exposure, maintain a clean-air room indoors, and check vulnerable neighbors.',
  };
}

export function findCleanestVentilationWindow(
  hourly: HourlyForecastPoint[]
): VentilationWindow {
  if (!hourly || hourly.length === 0) {
    return {
      startLabel: '14:00',
      endLabel: '16:00',
      avgPm25: 0,
      avgUsAqi: 0,
      reason: 'Early afternoon typically offers the highest solar mixing height.',
    };
  }

  if (hourly.length === 1) {
    const p = hourly[0];
    return {
      startLabel: p.hourLabel,
      endLabel: p.hourLabel,
      avgPm25: Math.round(p.pm25),
      avgUsAqi: Math.round(p.usAqi),
      reason: 'Lowest observed particulate concentration in the current window.',
    };
  }

  let bestIdx = 0;
  let bestScore = Infinity;

  for (let i = 0; i < hourly.length - 1; i++) {
    const avgPm = (hourly[i].pm25 + hourly[i + 1].pm25) / 2;
    const avgWind = (hourly[i].windKmh + hourly[i + 1].windKmh) / 2;
    // Lower PM2.5 is primary; slightly higher wind helps disperse stagnant indoor buildup faster
    const score = avgPm - Math.min(avgWind, 20) * 0.4;
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  const first = hourly[bestIdx];
  const second = hourly[bestIdx + 1];
  const avgPm25 = Math.round((first.pm25 + second.pm25) / 2);
  const avgUsAqi = Math.round((first.usAqi + second.usAqi) / 2);
  const avgWind = Math.round(((first.windKmh + second.windKmh) / 2) * 10) / 10;

  return {
    startLabel: first.hourLabel,
    endLabel: second.hourLabel,
    avgPm25,
    avgUsAqi,
    reason:
      avgPm25 > 90
        ? `Even the cleanest 2-hour window (${first.hourLabel}–${second.hourLabel}) remains elevated at ${avgPm25} µg/m³. Limit airing to a rapid 10-minute cross-breeze with filtration ready.`
        : `Lowest 2-hour PM2.5 trough (${avgPm25} µg/m³ · ${avgWind} km/h breeze), minimizing outdoor particulate entry when refreshing indoor CO₂.`,
  };
}

export function computeWinterInversionRisk(
  pm25: number,
  windKmh: number,
  tempC: number
): 'Low' | 'Moderate' | 'High' | 'Severe' {
  const coldFactor = tempC <= 12 ? 1 : 0;
  const calmWind = windKmh < 7;
  const veryCalmWind = windKmh < 4;

  if (pm25 >= 150 || (pm25 >= 95 && veryCalmWind && coldFactor === 1)) {
    return 'Severe';
  }
  if (pm25 >= 75 || (pm25 >= 45 && calmWind && coldFactor === 1)) {
    return 'High';
  }
  if (pm25 >= 35 || (pm25 >= 20 && calmWind)) {
    return 'Moderate';
  }
  return 'Low';
}

function buildHourlyCurve(
  basePm25: number,
  baseWind: number,
  baseTemp: number
): HourlyForecastPoint[] {
  // Typical winter urban diurnal smog curve: high morning rush + inversion (07-09),
  // midday/early-afternoon boundary-layer dispersion trough (13-16), and evening buildup (19-23).
  const multipliers = [
    1.15, 1.12, 1.08, 1.06, 1.1, 1.18,
    1.28, 1.35, 1.24, 1.05, 0.88, 0.76,
    0.66, 0.62, 0.64, 0.72, 0.86, 1.04,
    1.18, 1.26, 1.3, 1.28, 1.22, 1.18,
  ];

  const startDate = new Date('2026-11-27T00:00:00Z');
  return multipliers.map((mult, hour) => {
    const pm25 = Math.round(basePm25 * mult * 10) / 10;
    const pm10 = Math.round(pm25 * 1.68 * 10) / 10;
    const usAqi = estimateUsAqiFromPm25(pm25);
    const windShift = hour >= 12 && hour <= 16 ? 1.45 : hour >= 20 || hour <= 6 ? 0.72 : 1.0;
    const tempShift = hour >= 12 && hour <= 16 ? 5 : hour >= 2 && hour <= 7 ? -3 : 0;
    const pointDate = new Date(startDate.getTime() + hour * 3600 * 1000);
    return {
      timeIso: pointDate.toISOString(),
      hourLabel: `${String(hour).padStart(2, '0')}:00`,
      pm25,
      pm10,
      usAqi,
      windKmh: Math.round(baseWind * windShift * 10) / 10,
      tempC: Math.round((baseTemp + tempShift) * 10) / 10,
    };
  });
}

export function estimateUsAqiFromPm25(pm25: number): number {
  const c = Math.max(0, Math.floor(pm25 * 10) / 10);
  const breakpoints: Array<[number, number, number, number]> = [
    [0, 12.0, 0, 50],
    [12.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 350.4, 301, 400],
    [350.5, 500.4, 401, 500],
  ];

  for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
    if (c <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (c - cLow) + iLow);
    }
  }
  return 500;
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateLabels(dateStr: string): { dayLabel: string; shortDate: string } {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return { dayLabel: dateStr, shortDate: dateStr };
  }
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const dayLabel = SHORT_DAYS[dt.getUTCDay()] ?? dateStr;
  const shortDate = `${SHORT_MONTHS[dt.getUTCMonth()] ?? ''} ${dt.getUTCDate()}`;
  return { dayLabel, shortDate };
}

export function aggregateDailyTrend(
  times: string[],
  pm25Values: Array<number | null>,
  usAqiValues: Array<number | null>,
  fallbackPm25 = 18,
  maxDays = 7
): DailyTrendPoint[] {
  const byDate = new Map<string, { pm25: number[]; aqi: number[] }>();

  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (typeof t !== 'string' || !t.includes('T')) continue;
    const dateKey = t.slice(0, 10);
    const pm = pm25Values[i];
    const aq = usAqiValues[i];
    if (pm === null || pm === undefined || !Number.isFinite(pm)) continue;
    const bucket = byDate.get(dateKey) ?? { pm25: [], aqi: [] };
    bucket.pm25.push(pm);
    bucket.aqi.push(
      aq !== null && aq !== undefined && Number.isFinite(aq)
        ? aq
        : estimateUsAqiFromPm25(pm)
    );
    byDate.set(dateKey, bucket);
  }

  const sortedDates = Array.from(byDate.keys()).sort().slice(-maxDays);
  if (sortedDates.length === 0) {
    return buildWeeklyTrend(fallbackPm25);
  }

  return sortedDates.map((dateIso) => {
    const bucket = byDate.get(dateIso)!;
    const avgPm = bucket.pm25.reduce((sum, v) => sum + v, 0) / bucket.pm25.length;
    const peakPm = Math.max(...bucket.pm25);
    const avgAq = bucket.aqi.reduce((sum, v) => sum + v, 0) / bucket.aqi.length;
    const peakAq = Math.max(...bucket.aqi);
    const { dayLabel, shortDate } = formatDateLabels(dateIso);
    return {
      dateIso,
      dayLabel,
      shortDate,
      avgPm25: Math.round(avgPm * 10) / 10,
      peakPm25: Math.round(peakPm * 10) / 10,
      avgUsAqi: Math.round(avgAq),
      peakUsAqi: Math.round(peakAq),
    };
  });
}

export function buildWeeklyTrend(basePm25: number): DailyTrendPoint[] {
  // Deterministic 7-day winter smog buildup & mid-week dispersion pattern ending 2026-11-27
  const factors = [0.78, 0.86, 0.94, 0.82, 0.91, 1.04, 1.0];
  const endDateMs = Date.UTC(2026, 10, 27);
  return factors.map((factor, idx) => {
    const dayMs = endDateMs - (factors.length - 1 - idx) * 86400 * 1000;
    const dateIso = new Date(dayMs).toISOString().slice(0, 10);
    const { dayLabel, shortDate } = formatDateLabels(dateIso);
    const avgPm25 = Math.round(basePm25 * factor * 10) / 10;
    const peakPm25 = Math.round(avgPm25 * 1.32 * 10) / 10;
    return {
      dateIso,
      dayLabel,
      shortDate,
      avgPm25,
      peakPm25,
      avgUsAqi: estimateUsAqiFromPm25(avgPm25),
      peakUsAqi: estimateUsAqiFromPm25(peakPm25),
    };
  });
}

export const PRESET_CITIES: LocationTelemetry[] = [
  {
    city: 'New Delhi',
    region: 'Delhi NCR',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    timezone: 'Asia/Kolkata',
    observedAtIso: '2026-11-27T10:30:00Z',
    usAqi: 248,
    europeanAqi: 138,
    pm25: 198.4,
    pm10: 312.0,
    no2: 64.2,
    so2: 18.5,
    o3: 32.0,
    coUgM3: 1420,
    tempC: 11.4,
    windKmh: 3.8,
    humidityPct: 74,
    inversionRisk: 'Severe',
    hourly: buildHourlyCurve(168, 4.2, 12),
    weeklyTrend: buildWeeklyTrend(176),
    dataSource: 'preset',
  },
  {
    city: 'Lahore',
    region: 'Punjab',
    country: 'Pakistan',
    latitude: 31.5497,
    longitude: 74.3436,
    timezone: 'Asia/Karachi',
    observedAtIso: '2026-11-27T10:30:00Z',
    usAqi: 271,
    europeanAqi: 152,
    pm25: 221.0,
    pm10: 348.5,
    no2: 59.0,
    so2: 21.4,
    o3: 29.0,
    coUgM3: 1580,
    tempC: 10.8,
    windKmh: 3.1,
    humidityPct: 79,
    inversionRisk: 'Severe',
    hourly: buildHourlyCurve(188, 3.4, 11),
    weeklyTrend: buildWeeklyTrend(196),
    dataSource: 'preset',
  },
  {
    city: 'Salt Lake City',
    region: 'Utah',
    country: 'United States',
    latitude: 40.7608,
    longitude: -111.891,
    timezone: 'America/Denver',
    observedAtIso: '2026-11-27T10:30:00Z',
    usAqi: 134,
    europeanAqi: 68,
    pm25: 48.6,
    pm10: 76.2,
    no2: 41.8,
    so2: 6.2,
    o3: 44.0,
    coUgM3: 680,
    tempC: -1.5,
    windKmh: 4.5,
    humidityPct: 68,
    inversionRisk: 'High',
    hourly: buildHourlyCurve(44, 5.2, -1),
    weeklyTrend: buildWeeklyTrend(44),
    dataSource: 'preset',
  },
  {
    city: 'Milan',
    region: 'Lombardy',
    country: 'Italy',
    latitude: 45.4642,
    longitude: 9.19,
    timezone: 'Europe/Rome',
    observedAtIso: '2026-11-27T10:30:00Z',
    usAqi: 156,
    europeanAqi: 79,
    pm25: 65.2,
    pm10: 94.0,
    no2: 52.4,
    so2: 9.1,
    o3: 28.0,
    coUgM3: 790,
    tempC: 5.2,
    windKmh: 4.1,
    humidityPct: 82,
    inversionRisk: 'High',
    hourly: buildHourlyCurve(58, 4.4, 5),
    weeklyTrend: buildWeeklyTrend(58),
    dataSource: 'preset',
  },
  {
    city: 'Beijing',
    region: 'Beijing',
    country: 'China',
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 'Asia/Shanghai',
    observedAtIso: '2026-11-27T10:30:00Z',
    usAqi: 162,
    europeanAqi: 84,
    pm25: 76.5,
    pm10: 118.4,
    no2: 49.5,
    so2: 14.0,
    o3: 36.0,
    coUgM3: 940,
    tempC: 2.0,
    windKmh: 6.2,
    humidityPct: 54,
    inversionRisk: 'High',
    hourly: buildHourlyCurve(68, 6.8, 2),
    weeklyTrend: buildWeeklyTrend(68),
    dataSource: 'preset',
  },
  {
    city: 'London',
    region: 'Greater London',
    country: 'United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
    observedAtIso: '2026-11-27T10:30:00Z',
    usAqi: 64,
    europeanAqi: 34,
    pm25: 18.2,
    pm10: 29.5,
    no2: 33.4,
    so2: 4.5,
    o3: 48.0,
    coUgM3: 410,
    tempC: 7.5,
    windKmh: 14.2,
    humidityPct: 76,
    inversionRisk: 'Low',
    hourly: buildHourlyCurve(17, 14.2, 7),
    weeklyTrend: buildWeeklyTrend(17),
    dataSource: 'preset',
  },
];

import { memo } from 'react';
import { Leaf } from 'lucide-react';
import type { ImpactSummary } from '../types/airQuality';

interface HouseholdImpactCardProps {
  impact: ImpactSummary;
  cityName: string;
  selectedCount: number;
  isReferenceCity: boolean;
  onResetChoices: () => void;
}

export const HouseholdImpactCard = memo(function HouseholdImpactCard({
  impact,
  cityName,
  selectedCount,
  isReferenceCity,
  onResetChoices,
}: HouseholdImpactCardProps) {
  const maxDose = Math.max(100, impact.baselineDailyDoseUg);
  const baselineBarPct = Math.min(100, Math.round((impact.baselineDailyDoseUg / maxDose) * 100));
  const mitigatedBarPct = Math.min(100, Math.round((impact.mitigatedDailyDoseUg / maxDose) * 100));

  const maxIndoor = Math.max(20, impact.baselineIndoorPm25);
  const indoorBasePct = Math.min(100, Math.round((impact.baselineIndoorPm25 / maxIndoor) * 100));
  const indoorMitPct = Math.min(100, Math.round((impact.mitigatedIndoorPm25 / maxIndoor) * 100));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Modeled Household Impact in {cityName}
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            {selectedCount} active choice{selectedCount === 1 ? '' : 's'} modeled against {impact.outdoorPm25} µg/m³ {isReferenceCity ? 'sample' : 'outdoor'} PM2.5
          </p>
        </div>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={onResetChoices}
            className="min-h-[32px] px-1 text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline whitespace-nowrap shrink-0"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-slate-700">Estimated Daily Inhaled PM2.5 Dose</span>
            <span className="font-mono font-semibold text-teal-800 tabular-nums" data-testid="dose-reduction-pct">
              -{impact.doseReductionPct}% exposure
            </span>
          </div>
          <div className="mt-2 space-y-2">
            <div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Unmitigated baseline</span>
                <span className="font-mono tabular-nums">{impact.baselineDailyDoseUg} µg/day</span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-sm bg-slate-100">
                <div
                  className="h-full bg-slate-400 transition-all duration-200"
                  style={{ width: `${baselineBarPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-900 font-medium">
                <span>With your choices</span>
                <span className="font-mono tabular-nums" data-testid="mitigated-dose-ug">
                  {impact.mitigatedDailyDoseUg} µg/day
                </span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-sm bg-slate-100">
                <div
                  className="h-full bg-teal-700 transition-all duration-200"
                  style={{ width: `${mitigatedBarPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-slate-700">Estimated Indoor Living Room PM2.5</span>
            <span className="font-mono font-semibold text-teal-800 tabular-nums">
              -{impact.indoorReductionPct}% indoors
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-600">Without hacks</p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-slate-700 tabular-nums">
                {impact.baselineIndoorPm25} <span className="text-xs font-normal">µg/m³</span>
              </p>
              <div className="mt-1 h-1.5 w-full rounded-sm bg-slate-100">
                <div
                  className="h-full bg-slate-400"
                  style={{ width: `${indoorBasePct}%` }}
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-800 font-medium">With your plan</p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-teal-800 tabular-nums" data-testid="mitigated-indoor-pm25">
                {impact.mitigatedIndoorPm25} <span className="text-xs font-normal">µg/m³</span>
              </p>
              <div className="mt-1 h-1.5 w-full rounded-sm bg-slate-100">
                <div
                  className="h-full bg-teal-700"
                  style={{ width: `${indoorMitPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-600">Lung Burden Saved</p>
            <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
              {impact.cigaretteEquivalentsAvoided}
            </p>
            <p className="text-xs text-slate-600">cig-eq / day avoided</p>
          </div>
          <div>
            <p className="text-xs text-slate-600">Weekly CO₂e Cut</p>
            <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums" data-testid="weekly-co2-avoided">
              {impact.weeklyCo2AvoidedKg} kg
            </p>
            <p className="text-xs text-slate-600">
              {impact.weeklyPmAvoidedGrams} g PM2.5 avoided
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-600">Winter Season</p>
            <p className="mt-1 font-mono text-base font-semibold text-teal-800 tabular-nums">
              {impact.winterSeasonCo2AvoidedKg} kg
            </p>
            <p className="text-xs text-slate-600">13-wk modeled cut</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-600">
        <Leaf className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
        <p>
          {selectedCount === 0
            ? 'Adopt one or more choices on the left to estimate your indoor particulate drop and weekly neighborhood emissions reduction.'
            : `Modeled estimate: your selections lower daily inhaled fine particulates from ${impact.baselineDailyDoseUg} µg to ${impact.mitigatedDailyDoseUg} µg per person (~${impact.cigaretteEquivalentsAvoided} cigarettes/day equivalent avoided).`}
        </p>
      </div>
    </div>
  );
});

import { memo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { AiActionPlan, ImpactSummary, LocationTelemetry } from '../types/airQuality';
import { findCleanestVentilationWindow, getAqiCategory } from '../utils/airQuality';

interface CommunityBulletinSectionProps {
  telemetry: LocationTelemetry;
  impact: ImpactSummary;
  plan: AiActionPlan | null;
}

export const CommunityBulletinSection = memo(function CommunityBulletinSection({
  telemetry,
  impact,
  plan,
}: CommunityBulletinSectionProps) {
  const [copied, setCopied] = useState(false);
  const aqiInfo = getAqiCategory(telemetry.usAqi);
  const vent = findCleanestVentilationWindow(telemetry.hourly);
  const sourceLabel = telemetry.dataSource === 'preset' ? 'Reference Sample' : 'Observed';

  const bulletinText = plan?.communityNotice
    ? `${plan.communityNotice}\n\n[${telemetry.city} Clean-Air Snapshot (${sourceLabel}): US AQI ${telemetry.usAqi} (${aqiInfo.label}) · Best airing window ${vent.startLabel}–${vent.endLabel} · Modeled household cut: -${impact.doseReductionPct}% PM2.5 dose & ~${impact.weeklyCo2AvoidedKg} kg CO₂e/week avoided]`
    : `${telemetry.city} Neighborhood Clean-Air Advisory (${sourceLabel}): US AQI is ${telemetry.usAqi} (${aqiInfo.label}) with PM2.5 at ${telemetry.pm25.toFixed(1)} µg/m³ and ${telemetry.inversionRisk} winter inversion risk. Keep windows closed during morning/evening peaks and limit cross-ventilation to ${vent.startLabel}–${vent.endLabel} (~${vent.avgPm25} µg/m³). Together, shifting 3+ weekly car trips to transit and stopping engine idling at school gates avoids an estimated ~${Math.max(12, impact.weeklyCo2AvoidedKg)} kg CO₂e per household each week.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bulletinText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      id="community-bulletin"
      aria-labelledby="community-heading"
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="community-heading" className="text-xl font-bold tracking-tight text-slate-900">
              04. Neighborhood &amp; School Air Bulletin
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Share a clear, actionable notice with neighbors, apartment associations, or school parent groups.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 whitespace-nowrap shrink-0 hover:bg-slate-50 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />
                Copied to Clipboard
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy Bulletin
              </>
            )}
          </button>
          <span className="sr-only" aria-live="polite">
            {copied ? 'Community bulletin copied to clipboard.' : ''}
          </span>
        </div>

        <blockquote className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 whitespace-pre-line">
          {bulletinText}
        </blockquote>
      </div>
    </section>
  );
});

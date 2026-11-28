import { memo, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type {
  ImpactSummary,
  InterventionCategory,
  InterventionChoice,
} from '../types/airQuality';
import { INTERVENTION_CATALOG } from '../utils/impactCalculator';
import { HouseholdImpactCard } from './HouseholdImpactCard';

interface ImpactLabSectionProps {
  selectedChoiceIds: string[];
  onToggleChoice: (choiceId: string) => void;
  onResetChoices: () => void;
  impact: ImpactSummary;
  cityName: string;
  isReferenceCity: boolean;
}

type FilterTab = 'all' | InterventionCategory;

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: 'all', label: 'All Choices' },
  { id: 'routine', label: 'Daily Routines' },
  { id: 'indoor', label: 'Indoor Hacks' },
  { id: 'sustainable', label: 'Sustainable Swaps' },
];

function categoryHumanLabel(cat: InterventionCategory): string {
  switch (cat) {
    case 'routine':
      return 'Daily Routine';
    case 'indoor':
      return 'Indoor Air Hack';
    case 'sustainable':
      return 'Sustainable Swap';
  }
}

function ResilientEditorialImage({
  src,
  alt,
  caption,
  fallbackTitle,
}: {
  src: string;
  alt: string;
  caption: string;
  fallbackTitle: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      {failed ? (
        <div className="flex aspect-video w-full flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-teal-50 p-4 text-center">
          <ShieldCheck className="h-6 w-6 text-teal-700" aria-hidden="true" />
          <p className="mt-2 text-xs font-medium text-slate-700">{fallbackTitle}</p>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          width={896}
          height={500}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="aspect-video w-full object-cover"
        />
      )}
      <figcaption className="border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        {caption}
      </figcaption>
    </figure>
  );
}

export const ImpactLabSection = memo(function ImpactLabSection({
  selectedChoiceIds,
  onToggleChoice,
  onResetChoices,
  impact,
  cityName,
  isReferenceCity,
}: ImpactLabSectionProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedId, setExpandedId] = useState<string | null>('indoor_corsi_rosenthal');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedSet = useMemo(() => new Set(selectedChoiceIds), [selectedChoiceIds]);
  const visibleChoices = useMemo(
    () =>
      activeTab === 'all'
        ? INTERVENTION_CATALOG
        : INTERVENTION_CATALOG.filter((item) => item.category === activeTab),
    [activeTab]
  );

  const handleTabKeyDown = (idx: number, e: KeyboardEvent<HTMLButtonElement>) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % FILTER_TABS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + FILTER_TABS.length) % FILTER_TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = FILTER_TABS.length - 1;
    else return;

    e.preventDefault();
    setActiveTab(FILTER_TABS[nextIdx].id);
    tabRefs.current[nextIdx]?.focus();
  };

  return (
    <section
      id="impact-lab"
      aria-labelledby="impact-lab-heading"
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="impact-lab-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            02. Direct Impact Simulator
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Select routines, indoor air hacks, and low-emission swaps to estimate how much fine particulate exposure and winter pollution your household avoids.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Filter clean-air interventions"
          className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
        >
          {FILTER_TABS.map((tab, idx) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                id={`impact-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="impact-choices-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(idx, e)}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  selected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left: Interactive Choices List */}
        <div
          id="impact-choices-panel"
          role="tabpanel"
          aria-labelledby={`impact-tab-${activeTab}`}
          className="lg:col-span-7 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white"
        >
          {visibleChoices.map((choice: InterventionChoice) => {
            const isAdopted = selectedSet.has(choice.id);
            const isExpanded = expandedId === choice.id;

            const impactFragments: string[] = [];
            if (choice.indoorPmReductionPct > 0) {
              impactFragments.push(`-${choice.indoorPmReductionPct}% indoor PM2.5`);
            }
            if (choice.outdoorDoseReductionPct > 0) {
              impactFragments.push(`-${choice.outdoorDoseReductionPct}% outdoor dose`);
            }
            if (choice.weeklyCo2AvoidedKg > 0) {
              impactFragments.push(`-${choice.weeklyCo2AvoidedKg} kg CO₂e/wk`);
            }

            return (
              <div key={choice.id} className="p-5 transition-colors hover:bg-slate-50/60">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="font-medium text-teal-800">
                        {categoryHumanLabel(choice.category)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Cost: {choice.costTier}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-slate-700 tabular-nums">
                        {impactFragments.join(' · ')}
                      </span>
                    </div>

                    <h3 className="mt-1.5 text-base font-semibold text-slate-900">
                      {choice.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {choice.summary}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-pressed={isAdopted}
                    onClick={() => onToggleChoice(choice.id)}
                    className={`min-h-[40px] shrink-0 rounded-lg border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                      isAdopted
                        ? 'border-teal-700 bg-teal-700 text-white hover:bg-teal-800'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {isAdopted ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Adopted
                      </span>
                    ) : (
                      'Adopt Choice'
                    )}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2">
                  <p className="text-xs leading-relaxed text-slate-700">
                    <span className="font-semibold text-slate-900">Estimated impact: </span>
                    {choice.directImpactExplanation}
                  </p>

                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : choice.id)}
                    className="inline-flex min-h-[36px] items-center gap-1 text-xs font-medium text-teal-800 hover:underline whitespace-nowrap shrink-0"
                  >
                    {isExpanded ? 'Hide steps' : 'Action steps'}
                    {isExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <ol className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 pl-4 text-xs text-slate-600 list-decimal">
                    {choice.steps.map((step, i) => (
                      <li key={i} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Direct Impact Readout + Visual Field Guides */}
        <div className="lg:col-span-5 space-y-6">
          <HouseholdImpactCard
            impact={impact}
            cityName={cityName}
            selectedCount={selectedChoiceIds.length}
            isReferenceCity={isReferenceCity}
            onResetChoices={onResetChoices}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <ResilientEditorialImage
              src="/src/assets/images/indoor_air_sanctuary_1795776566922.jpg"
              alt="Winter apartment living room featuring a HEPA purifier and a DIY MERV-13 box fan cube next to a sealed window"
              caption="Indoor sanctuary: MERV-13 DIY filter cube + draft-sealed window"
              fallbackTitle="DIY MERV-13 Filtration & Sealed Sanctuary"
            />
            <ResilientEditorialImage
              src="/src/assets/images/clean_urban_commute_1795776568821.jpg"
              alt="Electric city tram and dedicated bike lane during a cool winter morning commute"
              caption="Low-emission shift: electric transit & off-peak corridors"
              fallbackTitle="Electric Transit & Low-Emission Mobility"
            />
          </div>
        </div>
      </div>
    </section>
  );
});

import { memo } from 'react';
import type {
  CommuteModeType,
  CookingFuelType,
  HomeEnclosureType,
  HouseholdProfile,
  PurifierSetupType,
  SensitivityGroup,
} from '../types/airQuality';

interface HouseholdProfilePanelProps {
  profile: HouseholdProfile;
  onChange: (next: HouseholdProfile) => void;
}

const SENSITIVITY_OPTIONS: Array<{ id: SensitivityGroup; label: string }> = [
  { id: 'infants_children', label: 'Infants & School Kids' },
  { id: 'elderly_seniors', label: 'Seniors (65+)' },
  { id: 'asthma_respiratory', label: 'Asthma / Heart Sensitivity' },
  { id: 'outdoor_athletes', label: 'Outdoor Runners / Workers' },
];

export const HouseholdProfilePanel = memo(function HouseholdProfilePanel({
  profile,
  onChange,
}: HouseholdProfilePanelProps) {
  const toggleSensitivity = (group: SensitivityGroup) => {
    const exists = profile.sensitivities.includes(group);
    const next = exists
      ? profile.sensitivities.filter((item) => item !== group)
      : [...profile.sensitivities, group];
    onChange({ ...profile, sensitivities: next });
  };

  return (
    <section
      aria-labelledby="household-heading"
      className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8"
    >
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 id="household-heading" className="text-lg font-semibold text-slate-900">
              01. Household &amp; Lifestyle Context
            </h2>
            <p className="text-sm text-slate-600">
              Tailor exposure baselines, indoor infiltration, and AI advice to how your household lives and commutes.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-600 tabular-nums">
            Saved locally in browser
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label
              htmlFor="home-type-select"
              className="block text-xs font-medium text-slate-700"
            >
              Home Envelope
            </label>
            <select
              id="home-type-select"
              value={profile.homeType}
              onChange={(e) =>
                onChange({ ...profile, homeType: e.target.value as HomeEnclosureType })
              }
              className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
            >
              <option value="drafty_older">Older / Drafty Windows</option>
              <option value="standard_apartment">Standard Urban Apartment</option>
              <option value="sealed_double_glazed">Well-Sealed Double-Glazed</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="cooking-fuel-select"
              className="block text-xs font-medium text-slate-700"
            >
              Primary Cooking Fuel
            </label>
            <select
              id="cooking-fuel-select"
              value={profile.cookingFuel}
              onChange={(e) =>
                onChange({ ...profile, cookingFuel: e.target.value as CookingFuelType })
              }
              className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
            >
              <option value="lpg_gas_stove">LPG / Natural Gas Stove</option>
              <option value="induction_electric">Induction / Electric</option>
              <option value="solid_biomass">Wood / Charcoal / Biomass</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="commute-mode-select"
              className="block text-xs font-medium text-slate-700"
            >
              Daily Commute Mode
            </label>
            <select
              id="commute-mode-select"
              value={profile.commuteMode}
              onChange={(e) =>
                onChange({ ...profile, commuteMode: e.target.value as CommuteModeType })
              }
              className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
            >
              <option value="private_car">Private Car</option>
              <option value="two_wheeler">Two-Wheeler / Scooter</option>
              <option value="public_transit">Metro / Electric Bus</option>
              <option value="walk_cycle">Walk / Bicycle</option>
              <option value="remote_wfh">Remote / Work from Home</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="purifier-setup-select"
              className="block text-xs font-medium text-slate-700"
            >
              Current Air Filtration
            </label>
            <select
              id="purifier-setup-select"
              value={profile.purifierSetup}
              onChange={(e) =>
                onChange({ ...profile, purifierSetup: e.target.value as PurifierSetupType })
              }
              className="mt-1.5 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
            >
              <option value="none">No Air Purifier Yet</option>
              <option value="diy_corsi_rosenthal">DIY Box Fan (MERV-13)</option>
              <option value="hepa_single_room">Single-Room HEPA Unit</option>
              <option value="hepa_whole_home">Multi-Room HEPA Filtration</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="commute-distance-range"
              className="flex items-center justify-between text-xs font-medium text-slate-700"
            >
              <span>Round-Trip Commute</span>
              <span className="font-mono text-slate-900 tabular-nums">
                {profile.dailyCommuteKm} km · {profile.householdSize} ppl
              </span>
            </label>
            <div className="mt-2.5 flex items-center gap-3">
              <input
                id="commute-distance-range"
                type="range"
                min={2}
                max={50}
                step={2}
                value={profile.dailyCommuteKm}
                onChange={(e) =>
                  onChange({ ...profile, dailyCommuteKm: Number(e.target.value) })
                }
                className="w-full accent-teal-700"
              />
              <label htmlFor="household-size-select" className="sr-only">
                Household size
              </label>
              <select
                id="household-size-select"
                value={profile.householdSize}
                onChange={(e) =>
                  onChange({ ...profile, householdSize: Number(e.target.value) })
                }
                className="min-h-[36px] rounded-md border border-slate-300 bg-white px-2 text-xs font-mono text-slate-900"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}p
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="mr-1 text-xs font-medium text-slate-600">
            Household sensitivities:
          </span>
          {SENSITIVITY_OPTIONS.map((opt) => {
            const active = profile.sensitivities.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleSensitivity(opt.id)}
                className={`min-h-[36px] rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-teal-700 bg-teal-50 text-teal-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {active ? '✓ ' : '+ '}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
});

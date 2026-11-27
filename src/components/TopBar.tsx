import React from 'react';

interface TopBarProps {
  onGeneratePlan: () => void;
  isGeneratingPlan: boolean;
}

export function TopBar({ onGeneratePlan, isGeneratingPlan }: TopBarProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        <a
          href="#telemetry-section"
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-teal-700 transition-colors"
        >
          ClearBreath
        </a>

        <nav aria-label="Primary sections" className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <a
            href="#telemetry-section"
            className="whitespace-nowrap shrink-0 py-1 hover:text-slate-900 hover:underline underline-offset-4 transition-colors"
          >
            Telemetry
          </a>
          <a
            href="#impact-lab"
            className="whitespace-nowrap shrink-0 py-1 hover:text-slate-900 hover:underline underline-offset-4 transition-colors"
          >
            Impact Lab
          </a>
          <a
            href="#ai-advisor"
            className="whitespace-nowrap shrink-0 py-1 hover:text-slate-900 hover:underline underline-offset-4 transition-colors"
          >
            AI Advisor
          </a>
          <a
            href="#community-bulletin"
            className="whitespace-nowrap shrink-0 py-1 hover:text-slate-900 hover:underline underline-offset-4 transition-colors"
          >
            Community
          </a>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onGeneratePlan}
            disabled={isGeneratingPlan}
            className="min-h-[40px] rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-teal-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isGeneratingPlan ? 'Generating Plan...' : 'Generate AI Plan'}
          </button>
        </div>
      </div>
    </header>
  );
}

import { memo, useState, type FormEvent } from 'react';
import { AlertCircle, RefreshCw, Send } from 'lucide-react';
import type { AiActionPlan, AiPlanItem, ChatMessage } from '../types/airQuality';

interface AiPlannerAndAdvisorProps {
  cityName: string;
  plan: AiActionPlan | null;
  isGeneratingPlan: boolean;
  planError: string | null;
  onGeneratePlan: () => void;
  chatMessages: ChatMessage[];
  isSendingChat: boolean;
  chatError: string | null;
  onSendChat: (question: string) => void;
}

const STARTER_PROMPTS = [
  'When is it safest to open windows today?',
  'How do we build a low-cost DIY air filter for our bedroom?',
  'What is the biggest emission cut our family can make this week?',
];

function PlanColumn({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: AiPlanItem[];
}) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p>
      </div>
      <div className="mt-4 space-y-4 divide-y divide-slate-100">
        {items.map((item, idx) => (
          <div key={idx} className={idx > 0 ? 'pt-4' : ''}>
            <p className="font-mono text-xs font-medium text-teal-800">
              {item.timingOrLocation}
            </p>
            <h4 className="mt-1 text-sm font-semibold text-slate-900">{item.title}</h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.actionSteps}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-800">
              <span className="font-semibold text-teal-900">Direct impact: </span>
              {item.directImpact}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AiPlannerAndAdvisor = memo(function AiPlannerAndAdvisor({
  cityName,
  plan,
  isGeneratingPlan,
  planError,
  onGeneratePlan,
  chatMessages,
  isSendingChat,
  chatError,
  onSendChat,
}: AiPlannerAndAdvisorProps) {
  const [question, setQuestion] = useState('');

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isSendingChat) return;
    onSendChat(question.trim());
    setQuestion('');
  };

  return (
    <section
      id="ai-advisor"
      aria-labelledby="ai-advisor-heading"
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="ai-advisor-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            03. GenAI Tailored Routine &amp; Family Advisor
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Synthesizes {cityName}’s hourly smog curve, your home enclosure, and commute choices into a tailored daily plan with modeled impact estimates.
          </p>
        </div>

        <button
          type="button"
          onClick={onGeneratePlan}
          disabled={isGeneratingPlan}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-teal-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw
            className={`h-4 w-4 ${isGeneratingPlan ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {isGeneratingPlan
            ? 'Generating Tailored Plan...'
            : plan
            ? 'Regenerate AI Plan'
            : 'Generate Tailored Plan'}
        </button>
      </div>

      {planError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Unable to generate AI action plan</p>
            <p className="mt-0.5 text-xs text-red-700">{planError}</p>
          </div>
        </div>
      )}

      {isGeneratingPlan && !plan && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Generating tailored AI action plan"
          className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3"
        >
          <span className="sr-only">Generating tailored AI action plan for {cityName}...</span>
          {[0, 1, 2].map((skeletonIdx) => (
            <div
              key={skeletonIdx}
              className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="h-4 w-1/2 rounded bg-slate-200" />
              <div className="mt-4 space-y-3">
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-5/6 rounded bg-slate-100" />
                <div className="h-3 w-4/6 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isGeneratingPlan && !plan && !planError && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <h3 className="text-base font-semibold text-slate-900">
                Ready to synthesize your {cityName} winter smog playbook
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Click &ldquo;Generate Tailored Plan&rdquo; to receive timed daily routines, affordable indoor air hacks calibrated to your home setup, and sustainable swaps with explicit health and emission impact metrics.
              </p>
            </div>
            <button
              type="button"
              onClick={onGeneratePlan}
              className="min-h-[42px] rounded-lg border border-teal-700 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900 whitespace-nowrap shrink-0 hover:bg-teal-100 transition-colors"
            >
              Build Plan for {cityName}
            </button>
          </div>
        </div>
      )}

      {plan && (
        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-medium text-teal-800">
              Personalized AI Brief · {cityName}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{plan.headline}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {plan.smogRiskSummary}
            </p>
            <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-800">
              <span className="font-semibold text-teal-900">Ventilation guidance: </span>
              {plan.cleanestVentilationWindow}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <PlanColumn
              title="Low-Emission Daily Routines"
              subtitle="Timed around hourly winter inversion troughs"
              items={plan.routines}
            />
            <PlanColumn
              title="Indoor Air Quality Hacks"
              subtitle="Low-cost filtration, sealing, and source control"
              items={plan.indoorHacks}
            />
            <PlanColumn
              title="Sustainable Alternatives"
              subtitle="Choices that protect your family & neighborhood air"
              items={plan.sustainableAlternatives}
            />
          </div>
        </div>
      )}

      {/* Interactive Multi-Turn AI Advisor */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-base font-semibold text-slate-900">
            Ask the Urban Air Quality Advisor
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            Grounded in {cityName}’s current AQI, 24-hour curve, and your household choices
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quick question starters">
          {STARTER_PROMPTS.map((starter) => (
            <button
              key={starter}
              type="button"
              disabled={isSendingChat}
              onClick={() => onSendChat(starter)}
              className="min-h-[36px] rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              {starter}
            </button>
          ))}
        </div>

        <div
          aria-live="polite"
          className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4"
        >
          {chatMessages.length === 0 ? (
            <p className="text-xs leading-relaxed text-slate-600">
              Ask about window ventilation timing, DIY Corsi-Rosenthal filter sizing, safe school commutes, or neighborhood carpooling ideas.
            </p>
          ) : (
            chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-auto max-w-xl border border-teal-200 bg-teal-50 text-slate-900'
                    : 'mr-auto max-w-2xl border border-slate-200 bg-white text-slate-800 whitespace-pre-line'
                }`}
              >
                <p className="mb-1 text-xs font-medium text-slate-600">
                  {msg.role === 'user' ? 'Your Household' : 'ClearBreath Advisor'}
                </p>
                {msg.text}
              </div>
            ))
          )}
          {isSendingChat && (
            <p role="status" className="text-xs font-medium text-teal-800">
              Analyzing local conditions and calculating exposure impact...
            </p>
          )}
        </div>

        {chatError && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
          >
            {chatError}
          </div>
        )}

        <form onSubmit={handleChatSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="advisor-chat-input" className="sr-only">
            Ask a question about indoor air quality, routines, or emissions
          </label>
          <input
            id="advisor-chat-input"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Ask about ${cityName} smog, indoor hacks, or commute swaps...`}
            className="min-h-[44px] flex-1 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-teal-700"
          />
          <button
            type="submit"
            disabled={isSendingChat || question.trim().length < 2}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white whitespace-nowrap shrink-0 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Ask Advisor
          </button>
        </form>
      </div>
    </section>
  );
});

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Footer } from './components/Footer';
import { HouseholdProfilePanel } from './components/HouseholdProfilePanel';
import { ImpactLabSection } from './components/ImpactLabSection';
import { LocationTelemetryHero } from './components/LocationTelemetryHero';
import { TopBar } from './components/TopBar';
import { PRESET_CITIES } from './data/presetCities';
import type {
  AiActionPlan,
  ChatMessage,
  HouseholdProfile,
  LocationTelemetry,
} from './types/airQuality';
import {
  calculateHouseholdImpact,
  DEFAULT_HOUSEHOLD_PROFILE,
  INTERVENTION_CATALOG,
} from './utils/impactCalculator';

const AiPlannerAndAdvisor = lazy(() =>
  import('./components/AiPlannerAndAdvisor').then((mod) => ({
    default: mod.AiPlannerAndAdvisor,
  }))
);

const CommunityBulletinSection = lazy(() =>
  import('./components/CommunityBulletinSection').then((mod) => ({
    default: mod.CommunityBulletinSection,
  }))
);

const PROFILE_STORAGE_KEY = 'clearbreath_household_profile_v1';
const CHOICES_STORAGE_KEY = 'clearbreath_adopted_choices_v1';
const DEFAULT_CHOICE_IDS = ['routine_afternoon_airing', 'indoor_draft_sealing'];
const CLIENT_TELEMETRY_CACHE_TTL_MS = 5 * 60 * 1000;
const CLIENT_TELEMETRY_CACHE_MAX = 20;

interface CachedClientTelemetry {
  telemetry: LocationTelemetry;
  fetchedAt: number;
}

function loadStoredProfile(): HouseholdProfile {
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_HOUSEHOLD_PROFILE;
    const parsed = JSON.parse(raw) as Partial<HouseholdProfile>;
    return {
      ...DEFAULT_HOUSEHOLD_PROFILE,
      ...parsed,
      sensitivities: Array.isArray(parsed.sensitivities)
        ? parsed.sensitivities
        : DEFAULT_HOUSEHOLD_PROFILE.sensitivities,
    };
  } catch {
    return DEFAULT_HOUSEHOLD_PROFILE;
  }
}

function loadStoredChoices(): string[] {
  try {
    const raw = window.localStorage.getItem(CHOICES_STORAGE_KEY);
    if (!raw) return DEFAULT_CHOICE_IDS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_CHOICE_IDS;
    const validIds = new Set(INTERVENTION_CATALOG.map((c) => c.id));
    return parsed.filter((id): id is string => typeof id === 'string' && validIds.has(id));
  } catch {
    return DEFAULT_CHOICE_IDS;
  }
}

export default function App() {
  const [telemetry, setTelemetry] = useState<LocationTelemetry>(PRESET_CITIES[0]);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);

  const [profile, setProfile] = useState<HouseholdProfile>(loadStoredProfile);
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>(loadStoredChoices);

  const [aiPlan, setAiPlan] = useState<AiActionPlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const telemetryAbortRef = useRef<AbortController | null>(null);
  const clientTelemetryCacheRef = useRef<Map<string, CachedClientTelemetry>>(new Map());

  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore storage quota errors
    }
  }, [profile]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHOICES_STORAGE_KEY, JSON.stringify(selectedChoiceIds));
    } catch {
      // Ignore storage quota errors
    }
  }, [selectedChoiceIds]);

  useEffect(() => {
    return () => {
      telemetryAbortRef.current?.abort();
    };
  }, []);

  const impact = useMemo(
    () => calculateHouseholdImpact(telemetry, profile, selectedChoiceIds),
    [telemetry, profile, selectedChoiceIds]
  );

  const writeClientCache = useCallback((key: string, data: LocationTelemetry) => {
    const cache = clientTelemetryCacheRef.current;
    if (cache.has(key)) {
      cache.delete(key);
    } else if (cache.size >= CLIENT_TELEMETRY_CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { telemetry: data, fetchedAt: Date.now() });
  }, []);

  const readClientCache = useCallback((key: string): LocationTelemetry | null => {
    const entry = clientTelemetryCacheRef.current.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > CLIENT_TELEMETRY_CACHE_TTL_MS) {
      clientTelemetryCacheRef.current.delete(key);
      return null;
    }
    return entry.telemetry;
  }, []);

  const handleSearchCity = useCallback(
    async (city: string) => {
      const cacheKey = `city:${city.trim().toLowerCase()}`;
      const cached = readClientCache(cacheKey);
      if (cached) {
        setTelemetry(cached);
        setTelemetryError(null);
        setAiPlan(null);
        return;
      }

      telemetryAbortRef.current?.abort();
      const controller = new AbortController();
      telemetryAbortRef.current = controller;

      setIsLoadingTelemetry(true);
      setTelemetryError(null);
      try {
        const res = await fetch(`/api/air-quality?city=${encodeURIComponent(city)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { telemetry?: LocationTelemetry; error?: string };
        if (!res.ok || !data.telemetry) {
          setTelemetryError(data.error ?? 'Unable to load air quality data for that city.');
          return;
        }
        writeClientCache(cacheKey, data.telemetry);
        setTelemetry(data.telemetry);
        setAiPlan(null);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setTelemetryError(
          'Network error while fetching live air quality data. Showing current reference city.'
        );
      } finally {
        if (telemetryAbortRef.current === controller) {
          setIsLoadingTelemetry(false);
        }
      }
    },
    [readClientCache, writeClientCache]
  );

  const handleSelectPreset = useCallback(
    async (preset: LocationTelemetry) => {
      const cacheKey = `coord:${preset.latitude.toFixed(2)},${preset.longitude.toFixed(2)}`;
      const cached = readClientCache(cacheKey);
      setTelemetryError(null);
      setAiPlan(null);

      if (cached) {
        setTelemetry(cached);
        return;
      }

      telemetryAbortRef.current?.abort();
      const controller = new AbortController();
      telemetryAbortRef.current = controller;

      setTelemetry(preset);
      try {
        const params = new URLSearchParams({
          lat: String(preset.latitude),
          lon: String(preset.longitude),
          name: preset.city,
          region: preset.region,
          country: preset.country,
        });
        const res = await fetch(`/api/air-quality?${params.toString()}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { telemetry?: LocationTelemetry };
          if (data.telemetry) {
            writeClientCache(cacheKey, data.telemetry);
            setTelemetry(data.telemetry);
          }
        }
      } catch {
        // Keep deterministic reference preset cleanly when offline or aborted
      }
    },
    [readClientCache, writeClientCache]
  );

  const handleToggleChoice = useCallback((choiceId: string) => {
    setSelectedChoiceIds((prev) =>
      prev.includes(choiceId)
        ? prev.filter((id) => id !== choiceId)
        : [...prev, choiceId]
    );
  }, []);

  const handleResetChoices = useCallback(() => {
    setSelectedChoiceIds([]);
  }, []);

  const handleGeneratePlan = useCallback(async () => {
    setIsGeneratingPlan(true);
    setPlanError(null);

    const plannerEl = document.getElementById('ai-advisor');
    if (plannerEl) {
      const prefersReducedMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      plannerEl.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }

    const adoptedTitles = INTERVENTION_CATALOG.filter((c) =>
      selectedChoiceIds.includes(c.id)
    ).map((c) => c.title);

    try {
      const res = await fetch('/api/assistant/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetry,
          profile,
          impact,
          adoptedTitles,
        }),
      });
      const data = (await res.json()) as { plan?: AiActionPlan; error?: string };
      if (!res.ok || !data.plan) {
        setPlanError(data.error ?? 'Failed to generate your tailored AI plan.');
        return;
      }
      setAiPlan(data.plan);
    } catch {
      setPlanError('Network error while connecting to the AI advisor service.');
    } finally {
      setIsGeneratingPlan(false);
    }
  }, [telemetry, profile, impact, selectedChoiceIds]);

  const handleSendChat = useCallback(
    async (questionText: string) => {
      setChatError(null);
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: questionText,
        timestamp: new Date().toISOString(),
      };

      const nextHistory = [...chatMessages, userMessage];
      setChatMessages(nextHistory);
      setIsSendingChat(true);

      try {
        const res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: questionText,
            history: chatMessages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
            telemetry,
            profile,
            impact,
          }),
        });
        const data = (await res.json()) as { reply?: string; error?: string };
        if (!res.ok || !data.reply) {
          setChatError(data.error ?? 'Unable to reach the AI advisor right now.');
          return;
        }
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: data.reply,
          timestamp: new Date().toISOString(),
        };
        setChatMessages([...nextHistory, assistantMessage]);
      } catch {
        setChatError('Network error while contacting the AI advisor.');
      } finally {
        setIsSendingChat(false);
      }
    },
    [chatMessages, telemetry, profile, impact]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        onGeneratePlan={handleGeneratePlan}
        isGeneratingPlan={isGeneratingPlan}
      />

      <main id="main-content" className="flex-1">
        <LocationTelemetryHero
          telemetry={telemetry}
          isLoading={isLoadingTelemetry}
          errorMessage={telemetryError}
          onSearchCity={handleSearchCity}
          onSelectPreset={handleSelectPreset}
        />

        <HouseholdProfilePanel profile={profile} onChange={setProfile} />

        <ImpactLabSection
          selectedChoiceIds={selectedChoiceIds}
          onToggleChoice={handleToggleChoice}
          onResetChoices={handleResetChoices}
          impact={impact}
          cityName={telemetry.city}
          isReferenceCity={telemetry.dataSource === 'preset'}
        />

        <Suspense
          fallback={
            <div
              role="status"
              aria-label="Loading AI planner and advisor"
              className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
            >
              <div className="h-64 w-full animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
            </div>
          }
        >
          <AiPlannerAndAdvisor
            cityName={telemetry.city}
            plan={aiPlan}
            isGeneratingPlan={isGeneratingPlan}
            planError={planError}
            onGeneratePlan={handleGeneratePlan}
            chatMessages={chatMessages}
            isSendingChat={isSendingChat}
            chatError={chatError}
            onSendChat={handleSendChat}
          />
        </Suspense>

        <Suspense
          fallback={
            <div
              role="status"
              aria-label="Loading community air bulletin"
              className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
            >
              <div className="h-36 w-full animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
            </div>
          }
        >
          <CommunityBulletinSection
            telemetry={telemetry}
            impact={impact}
            plan={aiPlan}
          />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}

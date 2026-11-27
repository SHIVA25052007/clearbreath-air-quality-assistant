/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { TopBar } from './components/TopBar';
import { LocationTelemetryHero } from './components/LocationTelemetryHero';
import { HouseholdProfilePanel } from './components/HouseholdProfilePanel';
import { ImpactLabSection } from './components/ImpactLabSection';
import { AiPlannerAndAdvisor } from './components/AiPlannerAndAdvisor';
import { CommunityBulletinSection } from './components/CommunityBulletinSection';
import { Footer } from './components/Footer';
import type {
  AiActionPlan,
  ChatMessage,
  HouseholdProfile,
  LocationTelemetry,
} from './types/airQuality';
import { PRESET_CITIES } from './utils/airQuality';
import {
  calculateHouseholdImpact,
  DEFAULT_HOUSEHOLD_PROFILE,
  INTERVENTION_CATALOG,
} from './utils/impactCalculator';

const PROFILE_STORAGE_KEY = 'clearbreath_household_profile_v1';
const CHOICES_STORAGE_KEY = 'clearbreath_adopted_choices_v1';
const DEFAULT_CHOICE_IDS = ['routine_afternoon_airing', 'indoor_draft_sealing'];

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

  const impact = useMemo(
    () => calculateHouseholdImpact(telemetry, profile, selectedChoiceIds),
    [telemetry, profile, selectedChoiceIds]
  );

  const handleSearchCity = async (city: string) => {
    setIsLoadingTelemetry(true);
    setTelemetryError(null);
    try {
      const res = await fetch(`/api/air-quality?city=${encodeURIComponent(city)}`);
      const data = (await res.json()) as { telemetry?: LocationTelemetry; error?: string };
      if (!res.ok || !data.telemetry) {
        setTelemetryError(data.error ?? 'Unable to load air quality data for that city.');
        return;
      }
      setTelemetry(data.telemetry);
      setAiPlan(null);
    } catch {
      setTelemetryError('Network error while fetching live air quality data. Showing current reference city.');
    } finally {
      setIsLoadingTelemetry(false);
    }
  };

  const handleSelectPreset = async (preset: LocationTelemetry) => {
    setTelemetry(preset);
    setTelemetryError(null);
    setAiPlan(null);
    // Try upgrading preset with live Open-Meteo telemetry silently
    try {
      const params = new URLSearchParams({
        lat: String(preset.latitude),
        lon: String(preset.longitude),
        name: preset.city,
        region: preset.region,
        country: preset.country,
      });
      const res = await fetch(`/api/air-quality?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { telemetry?: LocationTelemetry };
        if (data.telemetry) {
          setTelemetry(data.telemetry);
        }
      }
    } catch {
      // Keep deterministic preset cleanly when offline
    }
  };

  const handleToggleChoice = (choiceId: string) => {
    setSelectedChoiceIds((prev) =>
      prev.includes(choiceId)
        ? prev.filter((id) => id !== choiceId)
        : [...prev, choiceId]
    );
  };

  const handleResetChoices = () => {
    setSelectedChoiceIds([]);
  };

  const handleGeneratePlan = async () => {
    setIsGeneratingPlan(true);
    setPlanError(null);

    const plannerEl = document.getElementById('ai-advisor');
    if (plannerEl) {
      plannerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  };

  const handleSendChat = async (questionText: string) => {
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
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        onGeneratePlan={handleGeneratePlan}
        isGeneratingPlan={isGeneratingPlan}
      />

      <main className="flex-1">
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
        />

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

        <CommunityBulletinSection
          telemetry={telemetry}
          impact={impact}
          plan={aiPlan}
        />
      </main>

      <Footer />
    </div>
  );
}

import { GoogleGenAI, ThinkingLevel, type Content } from '@google/genai';
import type {
  AiActionPlan,
  HouseholdProfile,
  ImpactSummary,
  LocationTelemetry,
} from '../../types/airQuality.ts';
import {
  GEMINI_MAX_RETRY_ATTEMPTS,
  GEMINI_MODEL_NAME,
  GEMINI_PLACEHOLDER_KEY,
  GEMINI_RETRY_BACKOFF_MS,
  GEMINI_USER_AGENT,
} from '../constants.ts';
import {
  ACTION_PLAN_RESPONSE_SCHEMA,
  ACTION_PLAN_SYSTEM_INSTRUCTION,
  ADVISOR_SYSTEM_INSTRUCTION,
  buildActionPlanPrompt,
  buildAdvisorConversationContents,
  buildLocationSummaryForPrompt,
  parseActionPlanJson,
} from './geminiPrompts.ts';

export { buildLocationSummaryForPrompt, parseActionPlanJson };

export interface GeminiModelClient {
  models: {
    generateContent: (params: {
      model: string;
      contents: string | Content[];
      config?: Record<string, unknown>;
    }) => Promise<{ text?: string }>;
  };
}

function readGeminiApiKey(): string | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === GEMINI_PLACEHOLDER_KEY) {
    return null;
  }
  return apiKey;
}

export function isGeminiConfigured(): boolean {
  return readGeminiApiKey() !== null;
}

function getDefaultGeminiClient(): GeminiModelClient | null {
  const apiKey = readGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': GEMINI_USER_AGENT,
      },
    },
  }) as unknown as GeminiModelClient;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = GEMINI_MAX_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : 0;
      const retryable = status === 429 || status === 503 || status === 502;
      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, GEMINI_RETRY_BACKOFF_MS * attempt));
    }
  }
  throw lastError;
}

export function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: unknown }).status)
      : 500;

  if (status === 400 || rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message: 'The AI service rejected the request or API key. Check Settings > Secrets.',
    };
  }
  if (status === 403 || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'Permission denied by the AI service. Verify your API key in Settings > Secrets.',
    };
  }
  if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'AI rate limit reached. Wait a few seconds and try again.',
    };
  }
  if (status === 404 || rawMessage.includes('NOT_FOUND')) {
    return {
      status: 502,
      message: 'Configured Gemini model was unavailable.',
    };
  }
  return {
    status: 502,
    message: 'Unable to reach the Gemini AI service right now. Please retry shortly.',
  };
}

export type ServiceCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export async function generateTailoredActionPlan(params: {
  telemetry: LocationTelemetry;
  profile: HouseholdProfile;
  impact: ImpactSummary;
  adoptedTitles: string[];
  client?: GeminiModelClient | null;
}): Promise<ServiceCallResult<AiActionPlan>> {
  const ai = params.client !== undefined ? params.client : getDefaultGeminiClient();
  if (!ai) {
    return {
      ok: false,
      status: 503,
      error:
        'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to generate AI plans.',
    };
  }

  const prompt = buildActionPlanPrompt(params);

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: ACTION_PLAN_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: ACTION_PLAN_RESPONSE_SCHEMA,
        },
      })
    );

    const parsed = parseActionPlanJson(response.text ?? '{}');
    if (!parsed.ok) {
      return { ok: false, status: 502, error: parsed.error };
    }
    return { ok: true, data: parsed.plan };
  } catch (err: unknown) {
    const formatted = formatGeminiError(err);
    return { ok: false, status: formatted.status, error: formatted.message };
  }
}

export async function askAirQualityAdvisor(params: {
  message: string;
  history: Array<{ role: 'Assistant' | 'Family'; text: string }>;
  telemetry: LocationTelemetry;
  profile: HouseholdProfile;
  impact: ImpactSummary;
  client?: GeminiModelClient | null;
}): Promise<ServiceCallResult<string>> {
  const ai = params.client !== undefined ? params.client : getDefaultGeminiClient();
  if (!ai) {
    return {
      ok: false,
      status: 503,
      error:
        'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to chat with the AI advisor.',
    };
  }

  const contents = buildAdvisorConversationContents(params);

  try {
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: GEMINI_MODEL_NAME,
        contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: ADVISOR_SYSTEM_INSTRUCTION,
        },
      })
    );

    const reply = (response.text ?? '').trim();
    if (!reply) {
      return { ok: false, status: 502, error: 'Received an empty response from the AI advisor.' };
    }
    return { ok: true, data: reply };
  } catch (err: unknown) {
    const formatted = formatGeminiError(err);
    return { ok: false, status: formatted.status, error: formatted.message };
  }
}

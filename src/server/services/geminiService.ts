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
  GEMINI_REQUEST_TIMEOUT_MS,
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
      timeout: GEMINI_REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': GEMINI_USER_AGENT,
      },
    },
  }) as unknown as GeminiModelClient;
}

function extractErrorStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null) {
    if ('status' in err && typeof (err as { status?: unknown }).status === 'number') {
      return (err as { status: number }).status;
    }
    if ('statusCode' in err && typeof (err as { statusCode?: unknown }).statusCode === 'number') {
      return (err as { statusCode: number }).statusCode;
    }
  }
  return undefined;
}

export function sanitizeGeminiLogMessage(raw: string): string {
  return raw
    .replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_KEY]')
    .replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function logGeminiFailure(
  operation: 'plan' | 'chat',
  err: unknown,
  phase: 'retry' | 'final'
): void {
  const status = extractErrorStatus(err) ?? null;
  const errorType = err instanceof Error ? err.name : typeof err;
  const rawMessage = err instanceof Error ? err.message : String(err);
  const cause =
    typeof err === 'object' && err !== null && 'cause' in err
      ? (err as { cause?: unknown }).cause
      : undefined;
  const causeInfo =
    cause instanceof Error
      ? sanitizeGeminiLogMessage(`${cause.name}: ${cause.message}`)
      : typeof cause === 'object' && cause !== null && 'code' in cause
      ? String((cause as { code?: unknown }).code)
      : undefined;

  const summary = {
    operation,
    phase,
    status,
    errorType,
    message: sanitizeGeminiLogMessage(rawMessage),
    ...(causeInfo ? { cause: causeInfo } : {}),
  };

  if (phase === 'retry') {
    console.warn('[GeminiService] Retrying transient error:', JSON.stringify(summary));
  } else {
    console.error('[GeminiService] Request failed:', JSON.stringify(summary));
  }
}

function isTimeoutError(err: unknown, status: number, rawMessage: string): boolean {
  if (status === 504 || rawMessage.includes('DEADLINE_EXCEEDED')) {
    return true;
  }
  if (err instanceof Error) {
    return (
      err.name === 'AbortError' ||
      err.name === 'TimeoutError' ||
      rawMessage.includes('ETIMEDOUT') ||
      rawMessage.includes('HeadersTimeoutError')
    );
  }
  return false;
}

function isRetryableGeminiError(err: unknown, status: number): boolean {
  // Do not retry 429 quota/rate-limit errors immediately—retrying amplifies quota pressure.
  if (status === 503 || status === 502 || status === 500) {
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message;
    // Do not retry full request timeouts; only retry short-lived transport drops.
    if (isTimeoutError(err, status, msg)) {
      return false;
    }
    if (
      msg.includes('fetch failed') ||
      msg.includes('ECONNRESET') ||
      msg.includes('UND_ERR_SOCKET')
    ) {
      return true;
    }
  }
  return false;
}

async function withRetry<T>(
  operation: 'plan' | 'chat',
  fn: () => Promise<T>,
  maxAttempts = GEMINI_MAX_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = extractErrorStatus(err) ?? 0;
      const retryable = isRetryableGeminiError(err, status);
      if (!retryable || attempt === maxAttempts) {
        throw err;
      }
      logGeminiFailure(operation, err, 'retry');
      const delayMs = GEMINI_RETRY_BACKOFF_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const status = extractErrorStatus(err) ?? 500;

  if (status === 400 || rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message: 'The AI service rejected the request or API key. Check Settings > Secrets.',
    };
  }
  if (status === 401 || rawMessage.includes('UNAUTHENTICATED')) {
    return {
      status: 401,
      message: 'Authentication failed with the AI service. Verify your API key in Settings > Secrets.',
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
  if (status === 503 || rawMessage.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message:
        'The Gemini AI model is temporarily busy due to high demand. Please wait a few seconds and try again.',
    };
  }
  if (isTimeoutError(err, status, rawMessage)) {
    return {
      status: 504,
      message: 'The Gemini AI service timed out while generating a response. Please try again.',
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
    const response = await withRetry('plan', () =>
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
      console.error('[GeminiService] Invalid plan JSON returned from model:', parsed.error);
      return { ok: false, status: 502, error: parsed.error };
    }
    return { ok: true, data: parsed.plan };
  } catch (err: unknown) {
    logGeminiFailure('plan', err, 'final');
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
    const response = await withRetry('chat', () =>
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
      console.error('[GeminiService] Advisor returned empty text response.');
      return { ok: false, status: 502, error: 'Received an empty response from the AI advisor.' };
    }
    return { ok: true, data: reply };
  } catch (err: unknown) {
    logGeminiFailure('chat', err, 'final');
    const formatted = formatGeminiError(err);
    return { ok: false, status: formatted.status, error: formatted.message };
  }
}

import express, { type Express, type RequestHandler } from 'express';
import {
  AIR_QUALITY_RATE_LIMIT_MAX_REQUESTS,
  AIR_QUALITY_RATE_LIMIT_WINDOW_MS,
  JSON_BODY_LIMIT,
} from './constants.ts';
import { apiErrorHandler } from './middleware/errorHandler.ts';
import {
  createAiRateLimitMiddleware,
  createRateLimitMiddleware,
} from './middleware/rateLimit.ts';
import { createSecurityHeadersMiddleware } from './middleware/securityHeaders.ts';
import { createAirQualityRouter } from './routes/airQualityRoutes.ts';
import { createAssistantRouter } from './routes/assistantRoutes.ts';
import { createHealthRouter } from './routes/healthRoutes.ts';
import { type AirQualityService } from './services/airQualityService.ts';
import type {
  askAirQualityAdvisor,
  generateTailoredActionPlan,
} from './services/geminiService.ts';

export interface ApiAppOptions {
  airQualityService: AirQualityService;
  rateLimitMiddleware?: RequestHandler;
  airQualityRateLimitMiddleware?: RequestHandler;
  generateActionPlan?: typeof generateTailoredActionPlan;
  askAdvisor?: typeof askAirQualityAdvisor;
  isAiConfigured?: () => boolean;
  isProduction?: boolean;
}

export function createApiApp(options: ApiAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(createSecurityHeadersMiddleware(options.isProduction));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  const aiRateLimitMiddleware = options.rateLimitMiddleware ?? createAiRateLimitMiddleware();
  const airQualityRateLimitMiddleware =
    options.airQualityRateLimitMiddleware ??
    createRateLimitMiddleware({
      windowMs: AIR_QUALITY_RATE_LIMIT_WINDOW_MS,
      maxRequests: AIR_QUALITY_RATE_LIMIT_MAX_REQUESTS,
      errorPrefix: 'Too many air quality lookup requests',
    });

  app.use('/api/health', createHealthRouter({ isAiConfigured: options.isAiConfigured }));
  app.use(
    '/api/air-quality',
    createAirQualityRouter(options.airQualityService, airQualityRateLimitMiddleware)
  );
  app.use(
    '/api/assistant',
    createAssistantRouter({
      rateLimitMiddleware: aiRateLimitMiddleware,
      generateActionPlan: options.generateActionPlan,
      askAdvisor: options.askAdvisor,
    })
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use('/api', apiErrorHandler);

  return app;
}

import { Router, type Request, type Response } from 'express';
import { isGeminiConfigured } from '../services/geminiService.ts';

export interface HealthRouterOptions {
  isAiConfigured?: () => boolean;
}

export function createHealthRouter(options: HealthRouterOptions = {}): Router {
  const router = Router();
  const checkAiConfigured = options.isAiConfigured ?? isGeminiConfigured;

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      aiConfigured: checkAiConfigured(),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

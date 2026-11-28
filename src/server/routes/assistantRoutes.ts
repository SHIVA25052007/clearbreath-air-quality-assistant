import { Router, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import {
  validateAssistantChatRequest,
  validateAssistantPlanRequest,
} from '../../utils/validation.ts';
import {
  askAirQualityAdvisor,
  generateTailoredActionPlan,
} from '../services/geminiService.ts';

export interface AssistantRouterOptions {
  rateLimitMiddleware: RequestHandler;
  generateActionPlan?: typeof generateTailoredActionPlan;
  askAdvisor?: typeof askAirQualityAdvisor;
}

export function createAssistantRouter(options: AssistantRouterOptions): Router {
  const router = Router();
  const generateActionPlan = options.generateActionPlan ?? generateTailoredActionPlan;
  const askAdvisor = options.askAdvisor ?? askAirQualityAdvisor;

  router.post(
    '/plan',
    options.rateLimitMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validated = validateAssistantPlanRequest(req.body);
        if (!validated.valid) {
          res.status(400).json({ error: validated.error });
          return;
        }

        const result = await generateActionPlan({
          telemetry: validated.telemetry,
          profile: validated.profile,
          impact: validated.impact,
          adoptedTitles: validated.adoptedTitles,
        });

        if (!result.ok) {
          res.status(result.status).json({ error: result.error });
          return;
        }

        res.json({ plan: result.data });
      } catch (err: unknown) {
        next(err);
      }
    }
  );

  router.post(
    '/chat',
    options.rateLimitMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const validated = validateAssistantChatRequest(req.body);
        if (!validated.valid) {
          res.status(400).json({ error: validated.error });
          return;
        }

        const result = await askAdvisor({
          message: validated.message,
          history: validated.history,
          telemetry: validated.telemetry,
          profile: validated.profile,
          impact: validated.impact,
        });

        if (!result.ok) {
          res.status(result.status).json({ error: result.error });
          return;
        }

        res.json({ reply: result.data });
      } catch (err: unknown) {
        next(err);
      }
    }
  );

  return router;
}

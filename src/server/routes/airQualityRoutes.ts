import { Router, type Request, type RequestHandler, type Response } from 'express';
import {
  sanitizeTextInput,
  validateCityQuery,
  validateCoordinates,
} from '../../utils/validation.ts';
import {
  UpstreamServiceError,
  type AirQualityService,
} from '../services/airQualityService.ts';

export function createAirQualityRouter(
  airQualityService: AirQualityService,
  rateLimitMiddleware?: RequestHandler
): Router {
  const router = Router();
  const middlewares: RequestHandler[] = rateLimitMiddleware ? [rateLimitMiddleware] : [];

  router.get('/', ...middlewares, async (req: Request, res: Response) => {
    try {
      const hasLat = req.query.lat !== undefined;
      const hasLon = req.query.lon !== undefined;

      if (hasLat !== hasLon) {
        res.status(400).json({
          error: 'Both latitude and longitude are required when querying by coordinates.',
        });
        return;
      }

      if (hasLat && hasLon) {
        const coordCheck = validateCoordinates(req.query.lat, req.query.lon);
        if (!coordCheck.valid) {
          res.status(400).json({ error: coordCheck.error });
          return;
        }

        const city =
          sanitizeTextInput(req.query.name ?? 'Selected Location', 60) || 'Selected Location';
        const region = sanitizeTextInput(req.query.region ?? '', 60);
        const country = sanitizeTextInput(req.query.country ?? '', 60);

        const result = await airQualityService.getByCoordinates({
          city,
          region,
          country,
          latitude: coordCheck.lat,
          longitude: coordCheck.lon,
        });
        res.json(result);
        return;
      }

      const cityCheck = validateCityQuery(req.query.city);
      if (!cityCheck.valid) {
        res.status(400).json({ error: cityCheck.error });
        return;
      }

      const result = await airQualityService.getByCityName(cityCheck.city);
      if (!result) {
        res.status(404).json({
          error: `No matching city found for "${cityCheck.city}". Try adding a country or checking spelling.`,
        });
        return;
      }

      res.json(result);
    } catch (err: unknown) {
      if (err instanceof UpstreamServiceError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(502).json({
        error: 'Unable to fetch live air quality data right now. Please try again shortly.',
      });
    }
  });

  return router;
}

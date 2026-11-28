import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createApiApp } from './src/server/app.ts';
import { DEFAULT_PORT } from './src/server/constants.ts';
import { apiErrorHandler } from './src/server/middleware/errorHandler.ts';
import { createAirQualityService } from './src/server/services/airQualityService.ts';

const PORT = Number(process.env.PORT) || DEFAULT_PORT;

async function startServer(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const airQualityService = createAirQualityService();
  const app = createApiApp({ airQualityService, isProduction });

  const distDir = path.resolve(process.cwd(), 'dist');

  if (isProduction) {
    const indexHtmlPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
      throw new Error(
        'Production build directory "dist" is missing. Run "npm run build" before starting in production mode.'
      );
    }
    app.use(
      express.static(distDir, {
        maxAge: '1h',
        etag: true,
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(indexHtmlPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.use(apiErrorHandler);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `ClearBreath server listening on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start ClearBreath server:', err);
  process.exit(1);
});

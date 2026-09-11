/**
 * handlers/health.ts
 *
 * GET /health
 *
 * Lightweight health-check endpoint — used by:
 *   - Firebase uptime monitoring
 *   - CI/CD smoke tests after deploy
 *   - Load balancer health probes (if added later)
 *
 * Returns 200 with system metadata when the function is warm and
 * the Admin SDK has been successfully initialised.
 */

import type { Request, Response } from 'express';

import { getConfig } from '../config/firebase';
import { sendSuccess } from '../utils/errors';

export interface HealthResponse {
  status: 'ok';
  version: string;
  environment: string;
  region: string;
  timestamp: string;
  uptime: number;
}

/**
 * GET /health
 *
 * @returns 200 { success: true, data: HealthResponse }
 */
export function healthHandler(_req: Request, res: Response): void {
  const config = getConfig();

  const payload: HealthResponse = {
    status: 'ok',
    version: config.version,
    environment: config.nodeEnv,
    region: config.region,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  sendSuccess(res, payload);
}

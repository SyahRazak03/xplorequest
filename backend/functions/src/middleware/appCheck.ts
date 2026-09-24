/**
 * middleware/appCheck.ts
 *
 * Firebase App Check Verification Middleware (Stage 16 Hardening).
 *
 * Responsibilities:
 *   • Verifies X-Firebase-AppCheck header on incoming HTTP requests.
 *   • Blocks unauthorized bot/script traffic trying to bypass client app.
 *   • Exempts /health uptime checks and OPTIONS CORS preflights.
 *   • Supports dry-run / test bypass mode when APP_CHECK_ENFORCE === 'false'.
 */

import type { NextFunction, Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

import { AppError, ErrorCode } from '../utils/errors';

export async function verifyAppCheck(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  // 1. Exempt public health checks, auth routes, public form endpoints, and CORS preflight requests
  if (
    req.path === '/health' ||
    req.path.startsWith('/auth') ||
    req.path.startsWith('/public') ||
    req.method === 'OPTIONS'
  ) {
    return next();
  }

  // 2. Allow bypass in test mode or unless APP_CHECK_ENFORCE is explicitly set to 'true'
  if (
    process.env['NODE_ENV'] === 'test' ||
    process.env['APP_CHECK_ENFORCE'] !== 'true'
  ) {
    return next();
  }

  const appCheckToken = req.headers['x-firebase-appcheck'] as string | undefined;

  if (!appCheckToken) {
    return next(
      new AppError(
        ErrorCode.UNAUTHORIZED,
        'Firebase App Check token (X-Firebase-AppCheck) is required.'
      )
    );
  }

  try {
    await admin.appCheck().verifyToken(appCheckToken);
    return next();
  } catch (err) {
    logger.warn('Firebase App Check token verification failure:', err);
    return next(
      new AppError(
        ErrorCode.UNAUTHORIZED,
        'Firebase App Check token is invalid or expired.'
      )
    );
  }
}

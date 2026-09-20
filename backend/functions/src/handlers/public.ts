/**
 * handlers/public.ts
 *
 * Public unauthenticated router for Web Pre-Registration Form feature.
 *
 * Endpoints:
 *   GET  /public/events/:slug               — returns safe public event data subset
 *   POST /public/events/:slug/pre-register   — submits team pre-registration form with payment receipt
 *
 * Security:
 *   - No auth user session required.
 *   - Rate-limited per IP / endpoint.
 *   - App Check verification (reCAPTCHA v3/Enterprise for web origins).
 *   - Binary magic byte validation + Zod input schemas.
 *   - Output strictly projected to PublicSafeEventView (no joinCode, no secrets, no internal data).
 */

import { Router } from 'express';

import { verifyAppCheck } from '../middleware/appCheck';
import { rateLimiter } from '../middleware/rateLimiter';
import { getPublicEventBySlugService } from '../services/event.service';
import { submitPreRegistrationService } from '../services/preregistration.service';
import { asyncHandler, sendSuccess } from '../utils/errors';
import { PreRegisterSchema, validateBody } from '../validation';

export const publicRouter = Router();

publicRouter.get(
  '/events/:slug',
  rateLimiter({ identifier: (req) => `public_slug:${String(req.params['slug'] ?? '')}` }),
  asyncHandler(async (req, res) => {
    const slug = String(req.params['slug'] ?? '');
    const event = await getPublicEventBySlugService(slug);
    sendSuccess(res, event);
  })
);

publicRouter.post(
  '/events/:slug/pre-register',
  rateLimiter({ identifier: (req) => `prereg_ip:${req.ip || 'unknown'}` }),
  verifyAppCheck,
  validateBody(PreRegisterSchema),
  asyncHandler(async (req, res) => {
    const slug = String(req.params['slug'] ?? '');
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
    const result = await submitPreRegistrationService(slug, req.body, rawIp);
    sendSuccess(res, result, 201);
  })
);

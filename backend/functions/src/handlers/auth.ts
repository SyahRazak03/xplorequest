/**
 * handlers/auth.ts
 *
 * Express router for all authentication endpoints.
 *
 * Routes:
 *   POST /auth/admin/login      — email + password (admin only)
 *   POST /auth/crew/login       — marshalId + PIN + checkpointId + eventId
 *   POST /auth/participant/join — joinCode + teamName
 *   POST /auth/logout           — revoke refresh tokens (requires Bearer token)
 *   GET  /auth/me               — return role-scoped profile (requires Bearer token)
 *
 * Rate limiting:
 *   All login endpoints are rate-limited per IP+identifier via Firestore
 *   token-bucket (MAX_ATTEMPTS=5 / 15-min window → 30-min lockout).
 *
 * Input validation: Zod schemas ensure payload shape before service calls.
 */

import type { Request } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import { verifyFirebaseToken } from '../middleware/auth';
import { clearRateLimit, rateLimiter } from '../middleware/rateLimiter';
import {
  adminLogin,
  adminRegister,
  crewLogin,
  getMe,
  logout,
  participantJoin,
} from '../services/auth.service';
import {
  AppError,
  ErrorCode,
  asyncHandler,
  sendSuccess,
} from '../utils/errors';

export const authRouter = Router();

// ── Validation schemas ────────────────────────────────────────────────────────

const adminRegisterSchema = z.object({
  name: z.string().min(1, 'Name is required.').max(100),
  email: z.string().email('Invalid email.').max(254),
  password: z.string().min(6, 'Password must be at least 6 characters.').max(128),
  organization: z.string().max(100).optional(),
});

const adminLoginSchema = z.object({
  email: z.string().email('Invalid email.').max(254),
  password: z.string().min(6, 'Password is too short.').max(128),
});

const crewLoginSchema = z.object({
  marshalId: z
    .string()
    .max(64)
    .transform((v) => v.trim().toUpperCase())
    .optional(),
  crewPinCode: z
    .string()
    .length(4, 'PIN must be 4 digits.')
    .regex(/^\d{4}$/, 'PIN must be numeric digits only.'),
  checkpointId: z.string().min(1, 'Checkpoint ID is required.').max(32),
  eventId: z.string().min(1, 'Event ID is required.').max(64),
});

const participantJoinSchema = z.object({
  joinCode: z
    .string()
    .min(4, 'Invalid join code.')
    .max(10)
    .transform((v) => v.trim().toUpperCase()),
  teamName: z.string().min(1, 'Team name is required.').max(100).trim(),
});

// ── Helper: extract raw IP for rate limiter ───────────────────────────────────
function getIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string | undefined)
      ?.split(',')[0]
      .trim() ??
    req.socket.remoteAddress ??
    'unknown'
  );
}

function getBodyString(req: Request, key: string): string {
  const body = req.body as Record<string, unknown> | undefined;
  const val = body?.[key];
  return typeof val === 'string' ? val : '';
}

// ── POST /auth/admin/register ──────────────────────────────────────────────────

authRouter.post(
  '/admin/register',
  asyncHandler(async (req, res) => {
    const parsed = adminRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(ErrorCode.BAD_REQUEST, parsed.error.errors[0]?.message ?? 'Invalid input.');
    }

    const { name, email, password, organization } = parsed.data;
    const result = await adminRegister(name, email, password, organization);
    sendSuccess(res, result);
  })
);

// ── POST /auth/admin/login ────────────────────────────────────────────────────

authRouter.post(
  '/admin/login',
  rateLimiter({ identifier: (req) => getBodyString(req, 'email') }),
  asyncHandler(async (req, res) => {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(ErrorCode.BAD_REQUEST, parsed.error.errors[0]?.message ?? 'Invalid input.');
    }

    const { email, password } = parsed.data;
    const result = await adminLogin(email, password);

    // Clear rate-limit bucket on success
    await clearRateLimit(getIp(req), email);

    sendSuccess(res, result);
  })
);

// ── POST /auth/crew/login ─────────────────────────────────────────────────────

authRouter.post(
  '/crew/login',
  rateLimiter({ identifier: (req) => getBodyString(req, 'marshalId') || getBodyString(req, 'checkpointId') }),
  asyncHandler(async (req, res) => {
    const parsed = crewLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(ErrorCode.BAD_REQUEST, parsed.error.errors[0]?.message ?? 'Invalid input.');
    }

    const { marshalId, crewPinCode, checkpointId, eventId } = parsed.data;
    const result = await crewLogin(marshalId, crewPinCode, checkpointId, eventId);

    await clearRateLimit(getIp(req), marshalId || checkpointId);

    sendSuccess(res, result);
  })
);

// ── POST /auth/participant/join ───────────────────────────────────────────────

authRouter.post(
  '/participant/join',
  rateLimiter({ identifier: (req) => getBodyString(req, 'joinCode') }),
  asyncHandler(async (req, res) => {
    const parsed = participantJoinSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(ErrorCode.BAD_REQUEST, parsed.error.errors[0]?.message ?? 'Invalid input.');
    }

    const { joinCode, teamName } = parsed.data;
    const result = await participantJoin(joinCode, teamName);

    await clearRateLimit(getIp(req), joinCode);

    sendSuccess(res, result);
  })
);

// ── POST /auth/logout ─────────────────────────────────────────────────────────

authRouter.post(
  '/logout',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Authentication failed.');
    }
    await logout(uid);
    sendSuccess(res, { message: 'Successfully logged out.' });
  })
);

// ── GET /auth/me ──────────────────────────────────────────────────────────────

authRouter.get(
  '/me',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const uid = req.user?.uid;
    if (!uid) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Authentication failed.');
    }
    const profile = await getMe(uid);
    sendSuccess(res, profile);
  })
);

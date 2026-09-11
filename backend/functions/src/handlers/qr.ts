/**
 * handlers/qr.ts
 *
 * Express router for Dynamic HMAC QR Code Generation.
 *
 * Routes:
 *   POST /events/:eventId/checkpoints/:cpId/qr   — Generate dynamic checkpoint QR (crew/admin)
 *   POST /events/:eventId/attendance/qr          — Generate attendance check-in QR (crew/admin)
 */

import type { Request } from 'express';
import { Router } from 'express';

import { requireRole, verifyFirebaseToken } from '../middleware/auth';
import {
  generateAttendanceQrService,
  generateCheckpointQrService,
} from '../services/qr.service';
import {
  AppError,
  ErrorCode,
  asyncHandler,
  sendSuccess,
} from '../utils/errors';
import {
  GenerateAttendanceQrSchema,
  GenerateCheckpointQrSchema,
  validateBody,
} from '../validation';

export const qrRouter = Router({ mergeParams: true });

function requireCaller(req: Request) {
  const user = req.user;
  if (!user || !user.uid) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 'Pengesahan diperlukan.');
  }
  return user;
}

// ── POST /events/:eventId/checkpoints/:cpId/qr ────────────────────────────────

qrRouter.post(
  '/:eventId/checkpoints/:cpId/qr',
  verifyFirebaseToken,
  requireRole('admin', 'crew'),
  validateBody(GenerateCheckpointQrSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const cpId = String(req.params['cpId'] ?? '');

    if (!eventId || !cpId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Checkpoint ID diperlukan.');
    }

    const caller = requireCaller(req);
    const body = req.body as ReturnType<typeof GenerateCheckpointQrSchema.parse>;

    const result = await generateCheckpointQrService(
      eventId,
      cpId,
      caller,
      body
    );

    sendSuccess(res, result, 200);
  })
);

// ── POST /events/:eventId/attendance/qr ───────────────────────────────────────

qrRouter.post(
  '/:eventId/attendance/qr',
  verifyFirebaseToken,
  requireRole('admin', 'crew'),
  validateBody(GenerateAttendanceQrSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');

    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const caller = requireCaller(req);
    const body = req.body as ReturnType<typeof GenerateAttendanceQrSchema.parse>;

    const result = await generateAttendanceQrService(
      eventId,
      caller,
      body
    );

    sendSuccess(res, result, 200);
  })
);

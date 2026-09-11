/**
 * handlers/finish.ts
 *
 * Express router for participant finish line scan & gatekeeper verification.
 *
 * Route:
 *   POST /events/:eventId/finish — Finish line QR Scan & gatekeeper verification
 */

import type { Request } from 'express';
import { Router } from 'express';

import { requireRole, verifyFirebaseToken } from '../middleware/auth';
import { finishRaceService } from '../services/scan.service';
import {
  AppError,
  ErrorCode,
  asyncHandler,
  sendSuccess,
} from '../utils/errors';
import {
  FinishRaceScanSchema,
  validateBody,
} from '../validation';

export const finishRouter = Router({ mergeParams: true });

function requireParticipant(req: Request) {
  const user = req.user;
  if (!user || !user.uid) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 'Pengesahan diperlukan.');
  }
  if (!user.teamId) {
    throw new AppError(ErrorCode.FORBIDDEN, 'Akses ditolak: Pengguna mestilah ahli kumpulan yang sah.');
  }
  return user;
}

// ── POST /events/:eventId/finish ──────────────────────────────────────────────

finishRouter.post(
  '/:eventId/finish',
  verifyFirebaseToken,
  requireRole('participant'),
  validateBody(FinishRaceScanSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');

    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const caller = requireParticipant(req);
    const body = req.body as ReturnType<typeof FinishRaceScanSchema.parse>;

    const result = await finishRaceService(
      eventId,
      caller,
      body
    );

    sendSuccess(res, result, 200);
  })
);

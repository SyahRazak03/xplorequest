/**
 * handlers/scan.ts
 *
 * Express router for participant QR Scan verification.
 *
 * Route:
 *   POST /events/:eventId/checkpoints/:cpId/scan — Multi-layer scan verification
 */

import type { Request } from 'express';
import { Router } from 'express';

import { requireRole, verifyFirebaseToken } from '../middleware/auth';
import {
  skipCheckpointService,
  verifyAndProcessScanService,
} from '../services/scan.service';
import {
  AppError,
  ErrorCode,
  asyncHandler,
  sendSuccess,
} from '../utils/errors';
import {
  ScanCheckpointQrSchema,
  SkipCheckpointSchema,
  validateBody,
} from '../validation';

import { notifyCheckpointCompletion } from '../services/notification.service';
import { logger } from 'firebase-functions';

export const scanRouter = Router({ mergeParams: true });

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

// ── POST /events/:eventId/checkpoints/:cpId/scan ──────────────────────────────

scanRouter.post(
  '/:eventId/checkpoints/:cpId/scan',
  verifyFirebaseToken,
  requireRole('participant'),
  validateBody(ScanCheckpointQrSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const cpId = String(req.params['cpId'] ?? '');

    if (!eventId || !cpId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Checkpoint ID diperlukan.');
    }

    const caller = requireParticipant(req);
    const body = req.body as ReturnType<typeof ScanCheckpointQrSchema.parse>;

    const result = await verifyAndProcessScanService(
      eventId,
      cpId,
      caller,
      body
    );

    // Side-effect: Non-blocking push notification for next clue unlocked
    if (result.nextCheckpointId && !result.isFinish) {
      notifyCheckpointCompletion(
        eventId,
        result.teamId,
        cpId,
        result.nextCheckpointId
      ).catch((err) => {
        logger.error('Ralat pemberitahuan penyiapan pos kawalan:', err);
      });
    }

    sendSuccess(res, result, 200);
  })
);

// ── POST /events/:eventId/checkpoints/:cpId/skip ──────────────────────────────

scanRouter.post(
  '/:eventId/checkpoints/:cpId/skip',
  verifyFirebaseToken,
  requireRole('participant'),
  validateBody(SkipCheckpointSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const cpId = String(req.params['cpId'] ?? '');

    if (!eventId || !cpId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Checkpoint ID diperlukan.');
    }

    const caller = requireParticipant(req);
    const body = req.body as ReturnType<typeof SkipCheckpointSchema.parse>;

    const result = await skipCheckpointService(
      eventId,
      cpId,
      caller,
      body
    );

    sendSuccess(res, result, 200);
  })
);

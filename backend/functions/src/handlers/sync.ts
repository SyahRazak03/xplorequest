/**
 * handlers/sync.ts
 *
 * Express router for offline sync queue batch ingestion endpoint (FR-06).
 *
 * Route:
 *   POST /events/:eventId/sync — Batch ingestion of offline queued actions
 */

import { Router } from 'express';

import { requireRole, verifyFirebaseToken } from '../middleware/auth';
import { processBatchSync } from '../services/sync.service';
import { AppError, ErrorCode, asyncHandler, sendSuccess } from '../utils/errors';
import { BatchSyncSchema, validateBody } from '../validation';

export const syncRouter = Router({ mergeParams: true });

// ── POST /events/:eventId/sync ────────────────────────────────────────────────

syncRouter.post(
  '/:eventId/sync',
  verifyFirebaseToken,
  requireRole('admin', 'crew', 'participant'),
  validateBody(BatchSyncSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const caller = req.user;
    if (!caller || !caller.uid) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Pengesahan diperlukan.');
    }

    const body = req.body as ReturnType<typeof BatchSyncSchema.parse>;

    const results = await processBatchSync(eventId, caller, body);

    sendSuccess(res, results, 200);
  })
);

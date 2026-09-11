/**
 * handlers/verification.ts
 *
 * Express router for Stage 11: Crew Verification Wizard & Penalties.
 *
 * Routes:
 *   POST /events/:eventId/checkpoints/:cpId/teams/:teamId/photo-proof
 *   POST /events/:eventId/checkpoints/:cpId/teams/:teamId/manual-override
 *   POST /events/:eventId/teams/:teamId/penalty
 */

import { Router } from 'express';

import { requireRole, verifyFirebaseToken } from '../middleware/auth';
import {
  applyPenaltyService,
  manualOverrideService,
  uploadPhotoProofService,
} from '../services/verification.service';
import {
  AppError,
  ErrorCode,
  asyncHandler,
  sendSuccess,
} from '../utils/errors';
import {
  ApplyPenaltySchema,
  ManualOverrideSchema,
  UploadPhotoProofSchema,
  validateBody,
} from '../validation';

export const verificationRouter = Router({ mergeParams: true });

// ── POST /events/:eventId/checkpoints/:cpId/teams/:teamId/photo-proof ─────────

verificationRouter.post(
  '/:eventId/checkpoints/:cpId/teams/:teamId/photo-proof',
  verifyFirebaseToken,
  requireRole('admin', 'crew'),
  validateBody(UploadPhotoProofSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const cpId = String(req.params['cpId'] ?? '');
    const teamId = String(req.params['teamId'] ?? '');

    if (!eventId || !cpId || !teamId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID, Checkpoint ID, dan Team ID diperlukan.');
    }

    const caller = req.user!;
    const body = req.body as ReturnType<typeof UploadPhotoProofSchema.parse>;

    const result = await uploadPhotoProofService(
      eventId,
      cpId,
      teamId,
      caller,
      body
    );

    sendSuccess(res, result, 201);
  })
);

// ── POST /events/:eventId/checkpoints/:cpId/teams/:teamId/manual-override ─────

verificationRouter.post(
  '/:eventId/checkpoints/:cpId/teams/:teamId/manual-override',
  verifyFirebaseToken,
  requireRole('admin', 'crew'),
  validateBody(ManualOverrideSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const cpId = String(req.params['cpId'] ?? '');
    const teamId = String(req.params['teamId'] ?? '');

    if (!eventId || !cpId || !teamId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID, Checkpoint ID, dan Team ID diperlukan.');
    }

    const caller = req.user!;
    const body = req.body as ReturnType<typeof ManualOverrideSchema.parse>;

    const result = await manualOverrideService(
      eventId,
      cpId,
      teamId,
      caller,
      body
    );

    sendSuccess(res, result, 200);
  })
);

// ── POST /events/:eventId/teams/:teamId/penalty ───────────────────────────────

verificationRouter.post(
  '/:eventId/teams/:teamId/penalty',
  verifyFirebaseToken,
  requireRole('admin', 'crew'),
  validateBody(ApplyPenaltySchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const teamId = String(req.params['teamId'] ?? '');

    if (!eventId || !teamId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Team ID diperlukan.');
    }

    const caller = req.user!;
    const body = req.body as ReturnType<typeof ApplyPenaltySchema.parse>;

    const result = await applyPenaltyService(
      eventId,
      teamId,
      caller,
      body
    );

    sendSuccess(res, result, 200);
  })
);

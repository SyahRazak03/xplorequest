/**
 * handlers/rules.ts
 *
 * Express router for Stage 12: Admin Race Rules Configuration.
 *
 * Routes:
 *   PUT /events/:eventId/rules (Admin only)
 */

import { Router } from 'express';

import { requireRole, verifyFirebaseToken } from '../middleware/auth';
import { updateRaceRulesService } from '../services/rules.service';
import { AppError, ErrorCode, asyncHandler, sendSuccess } from '../utils/errors';
import { UpdateRaceRulesSchema, validateBody } from '../validation';

export const rulesRouter = Router({ mergeParams: true });

// ── PUT /events/:eventId/rules ────────────────────────────────────────────────

rulesRouter.put(
  '/:eventId/rules',
  verifyFirebaseToken,
  requireRole('admin'),
  validateBody(UpdateRaceRulesSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'ID Acara diperlukan.');
    }

    const caller = req.user!;
    const body = req.body as ReturnType<typeof UpdateRaceRulesSchema.parse>;

    const updatedRules = await updateRaceRulesService(eventId, caller, body);
    sendSuccess(res, updatedRules, 200);
  })
);

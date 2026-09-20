/**
 * handlers/leaderboard.ts
 *
 * Express router for Stage 12: Live Leaderboard Read Endpoint.
 *
 * Routes:
 *   GET /events/:eventId/leaderboard (Admin, Crew, Participant)
 */

import { Router } from 'express';

import { requireRole, verifyFirebaseToken } from '../middleware/auth';
import { findEventById } from '../repositories/event.repository';
import { assertEventOwner } from '../services/event.service';
import { getLeaderboardService } from '../services/leaderboard.service';
import { AppError, ErrorCode, asyncHandler, sendSuccess } from '../utils/errors';

export const leaderboardRouter = Router({ mergeParams: true });

// ── GET /events/:eventId/leaderboard ──────────────────────────────────────────

leaderboardRouter.get(
  '/:eventId/leaderboard',
  verifyFirebaseToken,
  requireRole('admin', 'crew', 'participant'),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'ID Acara diperlukan.');
    }

    const caller = req.user!;

    const event = await findEventById(eventId);
    if (!event) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
    }

    assertEventOwner(event, caller.uid, caller.role, caller.eventId);

    const leaderboardEntries = await getLeaderboardService(eventId);
    sendSuccess(res, leaderboardEntries, 200);
  })
);

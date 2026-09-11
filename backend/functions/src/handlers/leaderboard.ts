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

    // Explicit REST Handler Authorization Guard
    if (caller.role !== 'admin' && caller.eventId !== eventId) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Akses ditolak: Anda hanya boleh melihat papan pendahulu untuk acara anda sendiri.'
      );
    }

    const leaderboardEntries = await getLeaderboardService(eventId);
    sendSuccess(res, leaderboardEntries, 200);
  })
);

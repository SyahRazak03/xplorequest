/**
 * handlers/teams.ts
 *
 * Express router for all Team Registration and Team Management endpoints.
 *
 * Routes:
 *   POST   /events/:eventId/teams                — Register new team (unauthenticated, rate-limited)
 *   GET    /events/:eventId/teams                — List teams (admin/crew: all, participant: own team)
 *   GET    /events/:eventId/teams/:teamId        — Get team details
 *   PATCH  /events/:eventId/teams/:teamId        — Update team details (admin only)
 *   PATCH  /events/:eventId/teams/:teamId/status — Approve/reject team (admin only)
 *   DELETE /events/:eventId/teams/:teamId        — Remove team (admin only)
 */

import type { Request } from 'express';
import { Router } from 'express';

import { requireRole, verifyFirebaseToken } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import type { TeamStatus } from '../models';
import { getTeamStateService } from '../services/recovery.service';
import {
  deleteTeamService,
  getTeamService,
  listTeamsService,
  registerTeamService,
  setTeamStatusService,
  updateTeamService,
} from '../services/team.service';
import {
  AppError,
  ErrorCode,
  asyncHandler,
  sendSuccess,
} from '../utils/errors';
import {
  CreateTeamSchema,
  TeamStatusUpdateSchema,
  UpdateTeamSchema,
  validateBody,
} from '../validation';

export const teamsRouter = Router({ mergeParams: true });

function requireUid(req: Request): string {
  const uid = req.user?.uid;
  if (!uid) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 'Pengesahan diperlukan.');
  }
  return uid;
}

function getRole(req: Request): string {
  return req.user?.role || 'participant';
}

// ── POST /events/:eventId/teams — Register Team ───────────────────────────────

/**
 * Open registration endpoint — participants register before having a Firebase account.
 * Rate-limited by IP + eventId/joinCode hash.
 */
teamsRouter.post(
  '/:eventId/teams',
  rateLimiter({
    identifier: (req: Request) => {
      const body = req.body as Record<string, unknown> | undefined;
      const joinCode = typeof body?.['joinCode'] === 'string' ? body['joinCode'] : '';
      return `${req.params['eventId'] || 'unknown'}:${joinCode}`;
    },
  }),
  validateBody(CreateTeamSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const team = await registerTeamService(
      eventId,
      req.body as ReturnType<typeof CreateTeamSchema.parse>
    );

    sendSuccess(res, team, 201);
  })
);

// ── GET /events/:eventId/teams — List Teams ───────────────────────────────────

teamsRouter.get(
  '/:eventId/teams',
  verifyFirebaseToken,
  requireRole('admin', 'crew', 'participant'),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const role = getRole(req);
    const uid = req.user?.uid;
    const teamId = req.user?.teamId;
    const callerEventId = req.user?.eventId;

    const teams = await listTeamsService(eventId, role, uid, teamId, callerEventId);

    sendSuccess(res, teams, 200, {
      total: teams.length,
      role,
    });
  })
);

// ── GET /events/:eventId/teams/:teamId/state — Session State Recovery (FR-10) ─
// Declared before GET /:eventId/teams/:teamId so express matches /state accurately

teamsRouter.get(
  '/:eventId/teams/:teamId/state',
  verifyFirebaseToken,
  requireRole('admin', 'crew', 'participant'),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const teamId = String(req.params['teamId'] ?? '');

    if (!eventId || !teamId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Team ID diperlukan.');
    }

    const caller = req.user;
    if (!caller || !caller.uid) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Pengesahan diperlukan.');
    }

    const state = await getTeamStateService(eventId, teamId, caller);

    sendSuccess(res, state);
  })
);

// ── GET /events/:eventId/teams/:teamId — Get Single Team ──────────────────────

teamsRouter.get(
  '/:eventId/teams/:teamId',
  verifyFirebaseToken,
  requireRole('admin', 'crew', 'participant'),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const teamId = String(req.params['teamId'] ?? '');

    if (!eventId || !teamId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Team ID diperlukan.');
    }

    const role = getRole(req);
    const uid = req.user?.uid;
    const callerTeamId = req.user?.teamId;
    const callerEventId = req.user?.eventId;

    const team = await getTeamService(eventId, teamId, role, uid, callerTeamId, callerEventId);

    sendSuccess(res, team);
  })
);

// ── PATCH /events/:eventId/teams/:teamId/status — Approve / Reject Team ───────
// Declared before PATCH /:eventId/teams/:teamId so express matches /status accurately

teamsRouter.patch(
  '/:eventId/teams/:teamId/status',
  verifyFirebaseToken,
  requireRole('admin'),
  validateBody(TeamStatusUpdateSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const teamId = String(req.params['teamId'] ?? '');

    if (!eventId || !teamId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Team ID diperlukan.');
    }

    const uid = requireUid(req);
    const role = req.user?.role;
    const callerEventId = req.user?.eventId;
    const { status } = req.body as ReturnType<typeof TeamStatusUpdateSchema.parse>;

    const updated = await setTeamStatusService(
      eventId,
      teamId,
      status as TeamStatus,
      uid,
      role,
      callerEventId
    );

    sendSuccess(res, updated);
  })
);

// ── PATCH /events/:eventId/teams/:teamId — Update Team Details ────────────────

teamsRouter.patch(
  '/:eventId/teams/:teamId',
  verifyFirebaseToken,
  requireRole('admin'),
  validateBody(UpdateTeamSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const teamId = String(req.params['teamId'] ?? '');

    if (!eventId || !teamId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Team ID diperlukan.');
    }

    const uid = requireUid(req);
    const role = req.user?.role;
    const callerEventId = req.user?.eventId;
    const updated = await updateTeamService(
      eventId,
      teamId,
      req.body as ReturnType<typeof UpdateTeamSchema.parse>,
      uid,
      role,
      callerEventId
    );

    sendSuccess(res, updated);
  })
);

// ── DELETE /events/:eventId/teams/:teamId — Remove Team ───────────────────────

teamsRouter.delete(
  '/:eventId/teams/:teamId',
  verifyFirebaseToken,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const teamId = String(req.params['teamId'] ?? '');

    if (!eventId || !teamId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Team ID diperlukan.');
    }

    const uid = requireUid(req);
    const role = req.user?.role;
    const callerEventId = req.user?.eventId;
    await deleteTeamService(eventId, teamId, uid, role, callerEventId);

    sendSuccess(res, { deleted: true, eventId, teamId });
  })
);

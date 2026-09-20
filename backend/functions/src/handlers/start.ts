/**
 * handlers/start.ts
 *
 * Express router for Race Start, Cyclical Staggered Start Assignment, and Attendance Check-in.
 *
 * Routes:
 *   POST /events/:eventId/attendance/checkin       — Check in team attendance (crew/admin)
 *   POST /events/:eventId/start                    — Trigger atomic cyclical start algorithm (crew/admin)
 *   POST /events/:eventId/teams/:teamId/late-assign — Assign late-arriving team (crew/admin)
 */

import type { Request } from 'express';
import { Router } from 'express';

import { requireRole, verifyFirebaseToken } from '../middleware/auth';
import { notifyPreRaceAssignments } from '../services/notification.service';
import {
  assignLateArrivalService,
  checkinAttendanceService,
  triggerStaggeredStartService,
} from '../services/start.service';
import {
  AppError,
  ErrorCode,
  asyncHandler,
  sendSuccess,
} from '../utils/errors';
import { logger } from 'firebase-functions';
import {
  AttendanceCheckinSchema,
  LateAssignSchema,
  StartRaceSchema,
  validateBody,
} from '../validation';

export const startRouter = Router({ mergeParams: true });

function requireUid(req: Request): string {
  const uid = req.user?.uid;
  if (!uid) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 'Pengesahan diperlukan.');
  }
  return uid;
}

// ── POST /events/:eventId/attendance/checkin ──────────────────────────────────

startRouter.post(
  '/:eventId/attendance/checkin',
  verifyFirebaseToken,
  requireRole('admin', 'crew'),
  validateBody(AttendanceCheckinSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const uid = requireUid(req);
    const role = req.user?.role;
    const callerEventId = req.user?.eventId;
    const body = req.body as ReturnType<typeof AttendanceCheckinSchema.parse>;

    const team = await checkinAttendanceService(eventId, body, uid, role, callerEventId);

    sendSuccess(res, team, 200);
  })
);

// ── POST /events/:eventId/start ───────────────────────────────────────────────

startRouter.post(
  '/:eventId/start',
  verifyFirebaseToken,
  requireRole('admin', 'crew'),
  validateBody(StartRaceSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const uid = requireUid(req);
    const role = req.user?.role;
    const callerEventId = req.user?.eventId;
    const body = req.body as ReturnType<typeof StartRaceSchema.parse>;

    const result = await triggerStaggeredStartService(
      eventId,
      uid,
      body.forceStart,
      role,
      callerEventId
    );

    // Side-effect: Non-blocking push notifications for starting checkpoint assignments
    if (result.assignments && result.assignments.length > 0) {
      notifyPreRaceAssignments(eventId, result.assignments).catch((err) => {
        logger.error('Ralat pemberitahuan tugasan permulaan:', err);
      });
    }

    sendSuccess(res, result, 200);
  })
);

// ── POST /events/:eventId/teams/:teamId/late-assign ───────────────────────────

startRouter.post(
  '/:eventId/teams/:teamId/late-assign',
  verifyFirebaseToken,
  requireRole('admin', 'crew'),
  validateBody(LateAssignSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const teamId = String(req.params['teamId'] ?? '');

    if (!eventId || !teamId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Team ID diperlukan.');
    }

    const uid = requireUid(req);
    const role = req.user?.role;
    const callerEventId = req.user?.eventId;
    const body = req.body as ReturnType<typeof LateAssignSchema.parse>;

    const result = await assignLateArrivalService(
      eventId,
      teamId,
      uid,
      body,
      role,
      callerEventId
    );

    sendSuccess(res, result, 200);
  })
);

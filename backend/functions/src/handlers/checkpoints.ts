/**
 * handlers/checkpoints.ts
 *
 * Express router for Geofence Boundary and Checkpoint Management.
 *
 * Routes:
 *   PUT    /events/:eventId/boundary            — Save boundary polygon (admin only)
 *   POST   /events/:eventId/checkpoints         — Create checkpoint (admin only)
 *   GET    /events/:eventId/checkpoints         — List checkpoints (role-scoped)
 *   PATCH  /events/:eventId/checkpoints/reorder — Bulk re-order checkpoints (admin only)
 *   GET    /events/:eventId/checkpoints/:id     — Get checkpoint detail
 *   PATCH  /events/:eventId/checkpoints/:id     — Update checkpoint (admin only)
 *   DELETE /events/:eventId/checkpoints/:id     — Delete checkpoint (admin only)
 */

import type { Request } from 'express';
import { Router } from 'express';

import { requireRole, verifyFirebaseToken } from '../middleware/auth';
import {
  createCheckpointService,
  deleteCheckpointService,
  getCheckpointService,
  listCheckpointsService,
  reorderCheckpointsService,
  saveBoundaryService,
  updateCheckpointService,
} from '../services/checkpoint.service';
import {
  AppError,
  ErrorCode,
  asyncHandler,
  sendSuccess,
} from '../utils/errors';
import {
  CreateCheckpointSchema,
  ReorderCheckpointsSchema,
  SaveBoundarySchema,
  UpdateCheckpointSchema,
  validateBody,
} from '../validation';

export const checkpointsRouter = Router({ mergeParams: true });

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

// ── PUT /events/:eventId/boundary — Save Geofence Boundary ────────────────────

checkpointsRouter.put(
  '/:eventId/boundary',
  verifyFirebaseToken,
  requireRole('admin'),
  validateBody(SaveBoundarySchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const uid = requireUid(req);
    const { boundary } = req.body as ReturnType<typeof SaveBoundarySchema.parse>;

    const result = await saveBoundaryService(eventId, boundary, uid);

    sendSuccess(res, result);
  })
);

// ── POST /events/:eventId/checkpoints — Create Checkpoint ─────────────────────

checkpointsRouter.post(
  '/:eventId/checkpoints',
  verifyFirebaseToken,
  requireRole('admin'),
  validateBody(CreateCheckpointSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const uid = requireUid(req);
    const { checkpoint, warning } = await createCheckpointService(
      eventId,
      req.body as ReturnType<typeof CreateCheckpointSchema.parse>,
      uid
    );

    sendSuccess(res, checkpoint, 201, warning ? { warning } : undefined);
  })
);

// ── GET /events/:eventId/checkpoints — List Checkpoints ───────────────────────

checkpointsRouter.get(
  '/:eventId/checkpoints',
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

    const checkpoints = await listCheckpointsService(eventId, role, uid, teamId, callerEventId);

    sendSuccess(res, checkpoints, 200, {
      total: checkpoints.length,
      role,
    });
  })
);

// ── PATCH /events/:eventId/checkpoints/reorder — Reorder Checkpoints ──────────
// MUST be declared before /:id route so Express does not match "reorder" as :id

checkpointsRouter.patch(
  '/:eventId/checkpoints/reorder',
  verifyFirebaseToken,
  requireRole('admin'),
  validateBody(ReorderCheckpointsSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const uid = requireUid(req);
    const { checkpointIds } = req.body as ReturnType<typeof ReorderCheckpointsSchema.parse>;

    const reordered = await reorderCheckpointsService(eventId, checkpointIds, uid);

    sendSuccess(res, reordered);
  })
);

// ── GET /events/:eventId/checkpoints/:id — Get Single Checkpoint ──────────────

checkpointsRouter.get(
  '/:eventId/checkpoints/:id',
  verifyFirebaseToken,
  requireRole('admin', 'crew', 'participant'),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const checkpointId = String(req.params['id'] ?? '');

    if (!eventId || !checkpointId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Checkpoint ID diperlukan.');
    }

    const role = getRole(req);
    const uid = req.user?.uid;
    const teamId = req.user?.teamId;
    const callerEventId = req.user?.eventId;

    const checkpoint = await getCheckpointService(eventId, checkpointId, role, uid, teamId, callerEventId);

    sendSuccess(res, checkpoint);
  })
);

// ── PATCH /events/:eventId/checkpoints/:id — Update Checkpoint ────────────────

checkpointsRouter.patch(
  '/:eventId/checkpoints/:id',
  verifyFirebaseToken,
  requireRole('admin'),
  validateBody(UpdateCheckpointSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const checkpointId = String(req.params['id'] ?? '');

    if (!eventId || !checkpointId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Checkpoint ID diperlukan.');
    }

    const uid = requireUid(req);
    const { checkpoint, warning } = await updateCheckpointService(
      eventId,
      checkpointId,
      req.body as ReturnType<typeof UpdateCheckpointSchema.parse>,
      uid
    );

    sendSuccess(res, checkpoint, 200, warning ? { warning } : undefined);
  })
);

// ── DELETE /events/:eventId/checkpoints/:id — Delete Checkpoint ───────────────

checkpointsRouter.delete(
  '/:eventId/checkpoints/:id',
  verifyFirebaseToken,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const checkpointId = String(req.params['id'] ?? '');

    if (!eventId || !checkpointId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Checkpoint ID diperlukan.');
    }

    const uid = requireUid(req);
    const force = req.query['force'] === 'true';
    await deleteCheckpointService(eventId, checkpointId, force, uid);

    sendSuccess(res, { deleted: true, eventId, checkpointId });
  })
);

/**
 * handlers/preregistration_admin.ts
 *
 * Express router for Feature 5: Admin Review & Approval of Pre-Registrations.
 * All routes require admin authentication and per-event ownership verification.
 *
 * Routes:
 *   GET    /events/:eventId/pre-registrations          (List, filterable by status)
 *   GET    /events/:eventId/pre-registrations/:id       (Detail with signed receipt URL)
 *   PATCH  /events/:eventId/pre-registrations/:id/approve (Approve & create team)
 *   PATCH  /events/:eventId/pre-registrations/:id/reject  (Reject pre-registration)
 */

import { Router } from 'express';

import { requireRole, verifyFirebaseToken } from '../middleware/auth';
import type { PreRegistrationStatus } from '../models';
import {
  approvePreRegistrationService,
  getPreRegistrationDetailService,
  listPreRegistrationsService,
  rejectPreRegistrationService,
} from '../services/preregistration.service';
import { AppError, ErrorCode, asyncHandler, sendSuccess } from '../utils/errors';

export const preregistrationAdminRouter = Router({ mergeParams: true });

// Apply authentication & admin role guard to all routes in this router
preregistrationAdminRouter.use(verifyFirebaseToken, requireRole('admin'));

// ── GET /events/:eventId/pre-registrations — List Pre-Registrations ────────────

preregistrationAdminRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const statusParam = req.query['status'];
    let status: PreRegistrationStatus | undefined;
    if (statusParam === 'pending' || statusParam === 'approved' || statusParam === 'rejected') {
      status = statusParam;
    }

    const caller = req.user!;
    const list = await listPreRegistrationsService(
      eventId,
      status,
      caller.uid,
      caller.role,
      caller.eventId
    );

    sendSuccess(res, list, 200);
  })
);

// ── GET /events/:eventId/pre-registrations/:id — Pre-Registration Detail ──────

preregistrationAdminRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const id = String(req.params['id'] ?? '');

    if (!eventId || !id) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Pre-Registration ID diperlukan.');
    }

    const caller = req.user!;
    const detail = await getPreRegistrationDetailService(
      eventId,
      id,
      caller.uid,
      caller.role,
      caller.eventId
    );

    sendSuccess(res, detail, 200);
  })
);

// ── PATCH /events/:eventId/pre-registrations/:id/approve — Approve ────────────

preregistrationAdminRouter.patch(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const id = String(req.params['id'] ?? '');

    if (!eventId || !id) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Pre-Registration ID diperlukan.');
    }

    const caller = req.user!;
    const result = await approvePreRegistrationService(
      eventId,
      id,
      caller.uid,
      caller.role,
      caller.eventId
    );

    sendSuccess(res, result, 200);
  })
);

// ── PATCH /events/:eventId/pre-registrations/:id/reject — Reject ──────────────

preregistrationAdminRouter.patch(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['eventId'] ?? '');
    const id = String(req.params['id'] ?? '');

    if (!eventId || !id) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID dan Pre-Registration ID diperlukan.');
    }

    const caller = req.user!;
    const result = await rejectPreRegistrationService(
      eventId,
      id,
      caller.uid,
      caller.role,
      caller.eventId
    );

    sendSuccess(res, result, 200);
  })
);

/**
 * handlers/events.ts
 *
 * Express router for all Event Management endpoints.
 *
 * Routes:
 *   POST   /events              — create event (admin only)
 *   GET    /events              — list events  (all authenticated roles)
 *   GET    /events/:id          — event detail (all authenticated roles)
 *   PATCH  /events/:id          — update event (admin only, pre-race only)
 *   DELETE /events/:id          — archive event (admin only)
 *   GET    /events/:id/crew-pin — retrieve crewPinCode (admin only, rate-limited)
 *
 * Auth:
 *   All routes sit behind the global verifyFirebaseToken middleware applied
 *   in index.ts.  Per-route requireRole guards add role-level enforcement.
 *   Firestore security rules provide a second layer (defence-in-depth).
 *
 * Rate limiting:
 *   POST /events         — keyed on admin UID to prevent join-code fishing.
 *   GET  …/crew-pin      — keyed on admin UID to prevent brute-force discovery.
 */

import type { Request } from 'express';
import { Router } from 'express';

import { requireRole } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import {
  createEventService,
  deleteEventService,
  getCrewPinService,
  getEventService,
  listEventsService,
  rotateHmacSecretService,
  updateEventService,
  updatePaymentDetailsService,
  uploadEventAssetService,
} from '../services/event.service';
import {
  AppError,
  ErrorCode,
  asyncHandler,
  sendSuccess,
} from '../utils/errors';
import {
  CreateEventSchema,
  UpdateEventSchema,
  UpdatePaymentDetailsSchema,
  UploadEventAssetSchema,
  validateBody,
} from '../validation';

export const eventsRouter = Router();

// ── Helper: extract caller UID from request ───────────────────────────────────

function requireUid(req: Request): string {
  const uid = req.user?.uid;
  if (!uid) {
    throw new AppError(ErrorCode.UNAUTHORIZED, 'Pengesahan diperlukan.');
  }
  return uid;
}

function requireRole_(req: Request): string {
  const role = req.user?.role;
  if (!role) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Tiada peranan ditetapkan. Hubungi pentadbir.'
    );
  }
  return role;
}

// ── POST /events — Create Event ───────────────────────────────────────────────

/**
 * Rate-limiter keyed on the admin's UID (not IP alone) so legitimate
 * admins from office NAT share a single bucket per UID, not per IP.
 * Prevents rapid-fire join-code generation as a code-fishing attack.
 */
eventsRouter.post(
  '/',
  requireRole('admin'),
  rateLimiter({
    identifier: (req: Request) => req.user?.uid ?? 'unknown',
  }),
  validateBody(CreateEventSchema),
  asyncHandler(async (req, res) => {
    const uid = requireUid(req);
    const event = await createEventService(req.body as ReturnType<typeof CreateEventSchema.parse>, uid);
    sendSuccess(res, event, 201);
  })
);

// ── GET /events — List Events ─────────────────────────────────────────────────

eventsRouter.get(
  '/',
  requireRole('admin', 'crew', 'participant'),
  asyncHandler(async (req, res) => {
    const role = requireRole_(req);
    const uid = req.user?.uid;
    const result = await listEventsService(role, uid);

    sendSuccess(
      res,
      result.events,
      200,
      { total: result.events.length, role: result.role }
    );
  })
);

// ── GET /events/:id/crew-pin — Retrieve Crew PIN ──────────────────────────────
//
// Must be declared BEFORE GET /events/:id so Express does not swallow
// "crew-pin" as the :id parameter value.

eventsRouter.get(
  '/:id/crew-pin',
  requireRole('admin'),
  rateLimiter({
    identifier: (req: Request) => `crewpin:${req.user?.uid ?? 'unknown'}`,
  }),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['id'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const uid = requireUid(req);
    const data = await getCrewPinService(eventId, uid);
    sendSuccess(res, data);
  })
);

// ── GET /events/:id — Event Detail ────────────────────────────────────────────

eventsRouter.get(
  '/:id',
  requireRole('admin', 'crew', 'participant'),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['id'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const role = requireRole_(req);
    const uid = req.user?.uid;
    const callerEventId = req.user?.eventId;
    const event = await getEventService(eventId, role, uid, callerEventId);
    sendSuccess(res, event);
  })
);

// ── PATCH /events/:id/payment-details — Update Event Payment Details ────────

eventsRouter.patch(
  '/:id/payment-details',
  requireRole('admin'),
  validateBody(UpdatePaymentDetailsSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['id'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const uid = requireUid(req);
    const updated = await updatePaymentDetailsService(
      eventId,
      req.body as ReturnType<typeof UpdatePaymentDetailsSchema.parse>,
      uid
    );
    sendSuccess(res, updated);
  })
);

// ── PATCH /events/:id — Update Event ─────────────────────────────────────────

eventsRouter.patch(
  '/:id',
  requireRole('admin'),
  validateBody(UpdateEventSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['id'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const uid = requireUid(req);
    const updated = await updateEventService(
      eventId,
      req.body as ReturnType<typeof UpdateEventSchema.parse>,
      uid
    );
    sendSuccess(res, updated);
  })
);

// ── DELETE /events/:id — Delete Event ────────────────────────────────────────

eventsRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['id'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID is required.');
    }

    const uid = requireUid(req);
    await deleteEventService(eventId, uid);
    sendSuccess(res, { deleted: true, archived: true, eventId });
  })
);

// ── POST /events/:id/assets — Upload Event Public Asset (Banner / Payment QR)

eventsRouter.post(
  '/:id/assets',
  requireRole('admin'),
  validateBody(UploadEventAssetSchema),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['id'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const caller = req.user;
    if (!caller) {
      throw new AppError(ErrorCode.UNAUTHORIZED, 'Pengesahan diperlukan.');
    }

    const result = await uploadEventAssetService(
      eventId,
      caller,
      req.body as ReturnType<typeof UploadEventAssetSchema.parse>
    );
    sendSuccess(res, result);
  })
);

// ── POST /events/:id/rotate-hmac — Rotate Event HMAC Secret Key ──────────────

eventsRouter.post(
  '/:id/rotate-hmac',
  requireRole('admin'),
  rateLimiter({
    identifier: (req: Request) => `rotatehmac:${req.user?.uid ?? 'unknown'}`,
  }),
  asyncHandler(async (req, res) => {
    const eventId = String(req.params['id'] ?? '');
    if (!eventId) {
      throw new AppError(ErrorCode.BAD_REQUEST, 'Event ID diperlukan.');
    }

    const uid = requireUid(req);
    const result = await rotateHmacSecretService(eventId, uid);
    sendSuccess(res, result);
  })
);

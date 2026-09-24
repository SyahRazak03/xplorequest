/**
 * services/event.service.ts
 *
 * Business-logic layer for event lifecycle management.
 *
 * Responsibilities:
 *   • Join-code uniqueness + auto-generation
 *   • crewPinCode + hmacSecret generation on event creation
 *   • Role-scoped list/get responses (admin vs crew/participant)
 *   • Race-start integrity guards on PATCH
 *   • Team-attachment guard on DELETE
 *
 * This layer calls the repository for Firestore access and throws
 * AppError for domain violations — never returns raw Firestore data.
 */

import * as crypto from 'crypto';

import { getFirestore, getStorageBucket } from '../config/firebase';
import type { AuthenticatedUser } from '../middleware/auth';
import type { EventDocument, PublicSafeEventView, UserDocument, UserRole } from '../models';
import { findCheckpointsByEvent } from '../repositories/checkpoint.repository';
import type {
  PublicEventView,
} from '../repositories/event.repository';
import {
  archiveEvent,
  createEvent,
  eventHasTeams,
  findActiveEvents,
  findAllEvents,
  findEventById,
  findEventByJoinCode,
  findEventsByOwner,
  findEventBySlug,
  getEventSecrets,
  setEventSecrets,
  updateEvent,
} from '../repositories/event.repository';
import type { CreateEventInput, UpdateEventInput, UpdatePaymentDetailsInput, UploadEventAssetInput } from '../validation';
import { AppError, ErrorCode } from '../utils/errors';
import { MAX_IMAGE_SIZE_BYTES, validateImageMagicBytes } from '../utils/image';

// ── Ownership Helper ──────────────────────────────────────────────────────────

/**
 * Utility helper to assert that the caller is authorized to operate on the specified event.
 *
 * Authorization rules:
 *   • role === 'admin': callerUid MUST match event.createdBy.
 *   • role === 'crew': callerEventId MUST match event.id.
 *   • role === 'participant' / missing role: allowed for public read operations.
 *
 * Grace-period fallback for missing createdBy:
 *   • If event.createdBy is missing/undefined (legacy unowned event document),
 *     logs a structured console.warn warning and permits access so legacy events
 *     remain functional while backfilling.
 *
 * @throws AppError(403 FORBIDDEN) if caller is not the owner/assigned crew.
 */
export function assertEventOwner(
  event: EventDocument,
  callerUid: string,
  callerRole: UserRole = 'admin',
  callerEventId?: string
): void {
  // 1. Crew access guard: crew members are assigned to a specific event via token claim
  if (callerRole === 'crew') {
    if (!callerEventId || callerEventId !== event.id) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'You do not have permission to manage this event.'
      );
    }
    return;
  }

  // 2. Admin access guard: admin must be the creator of the event
  if (callerRole === 'admin' || !callerRole) {
    if (!event.createdBy) {
      console.warn(
        `[SECURITY WARNING] Event '${event.id}' lacks 'createdBy' owner field. Access allowed during migration period.`
      );
      return;
    }

    if (event.createdBy !== callerUid) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'You do not have permission to manage this event.'
      );
    }
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum attempts to generate a unique join code before giving up. */
const JOIN_CODE_MAX_RETRIES = 5;

// ── Return types ──────────────────────────────────────────────────────────────

/** Full event document returned to admin callers. */
export type EventAdminView = EventDocument;

/** Restricted event view returned to crew/participant callers. */
export { PublicEventView };

export type ListEventsResult =
  | { role: 'admin'; events: EventAdminView[] }
  | { role: 'crew' | 'participant'; events: PublicEventView[] };

// ── Create Event ──────────────────────────────────────────────────────────────

/**
 * Creates a new event, generates secrets, and writes the secrets subcollection.
 *
 * Join code:
 *   • If the caller supplies one, verify uniqueness; throw 409 if taken.
 *   • If omitted, auto-generate a 6-char uppercase alphanumeric code and
 *     retry up to JOIN_CODE_MAX_RETRIES times on collision.
 *
 * Secrets:
 *   • crewPinCode — 4-digit random number (matches auth.service.ts expectation)
 *   • hmacSecret  — 32 random bytes hex-encoded (used by QR generation)
 *
 * These are written to events/{id}/secrets/config via the Admin SDK so
 * the client-facing `allow read, write: if false` rule in firestore.rules
 * never applies.
 */
export async function createEventService(
  input: CreateEventInput,
  createdByUid: string
): Promise<EventAdminView> {
  // ── 1. Resolve join code ────────────────────────────────────────────────────
  let joinCode: string;

  if (input.joinCode) {
    // Caller supplied a code — verify uniqueness
    const existing = await findEventByJoinCode(input.joinCode);
    if (existing) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Join code '${input.joinCode}' is already in use. Please choose another code.`
      );
    }
    joinCode = input.joinCode.toUpperCase();
  } else {
    // Auto-generate a unique 6-char code
    joinCode = await generateUniqueJoinCode();
  }

  // ── 1b. Resolve urlSlug ───────────────────────────────────────────────────
  let urlSlug: string;
  if (input.urlSlug) {
    const existingSlug = await findEventBySlug(input.urlSlug);
    if (existingSlug) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `URL slug '${input.urlSlug}' is already in use. Please choose another slug.`
      );
    }
    urlSlug = input.urlSlug.toLowerCase();
  } else {
    urlSlug = await generateUniqueSlug(input.name);
  }

  // ── 2. Generate secrets ─────────────────────────────────────────────────────
  const crewPinCode = String(
    Math.floor(Math.random() * 9000) + 1000
  ); // 4-digit string "1000"–"9999"

  const hmacSecret = crypto.randomBytes(32).toString('hex');

  // ── 3. Write event document ─────────────────────────────────────────────────
  const eventData: Omit<EventDocument, 'id' | 'createdAt' | 'updatedAt'> = {
    name: input.name,
    joinCode,
    date: input.date,
    startTime: input.startTime ?? '',
    maxDurationSeconds: input.maxDurationSeconds,
    locationName: input.locationName,
    totalCheckpoints: input.totalCheckpoints,
    maxTeamSize: input.maxTeamSize ?? 4,
    isStarted: false,
    startedAt: null,
    isFinished: false,
    urlSlug,
    entryFee: input.entryFee ?? 0,
    paymentBankDetails: input.paymentBankDetails ?? '',
    paymentDetails: (input.paymentDetails as any) || undefined,
    bannerImageUrl: input.bannerImageUrl ?? null,
    paymentQrImageUrl: input.paymentQrImageUrl ?? null,
    createdBy: createdByUid,
    updatedBy: createdByUid,
    // isArchived is not in EventDocument type but is stored; cast below
    ...(({ isArchived: false } as unknown) as Record<string, unknown>),
  };

  const created = await createEvent(eventData as Parameters<typeof createEvent>[0], createdByUid);

  // ── 4. Write secrets subcollection (Admin SDK — bypasses client rules) ──────
  await setEventSecrets(created.id, { crewPinCode, hmacSecret, hmacKeyId: 1 });

  return created;
}

// ── List Events ───────────────────────────────────────────────────────────────

/**
 * Returns events scoped by the caller's role:
 *   admin       → all non-archived events, full document
 *   crew/participant → active (non-started, non-finished) events, public fields
 */
export async function listEventsService(
  callerRole: string,
  callerUid?: string
): Promise<ListEventsResult> {
  if (callerRole === 'admin') {
    const events = callerUid ? await findEventsByOwner(callerUid) : await findAllEvents();
    return { role: 'admin', events };
  }

  const events = await findActiveEvents();
  return {
    role: callerRole as 'crew' | 'participant',
    events,
  };
}

// ── Get Event ─────────────────────────────────────────────────────────────────

/**
 * Fetches a single event.
 *   admin       → full document (including joinCode, subject to ownership check)
 *   crew        → public fields only (subject to assigned event check)
 *   participant → public fields only
 */
export async function getEventService(
  eventId: string,
  callerRole: string,
  callerUid?: string,
  callerEventId?: string
): Promise<EventAdminView | PublicEventView> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Event with ID '${eventId}' not found.`
    );
  }

  if (callerUid) {
    assertEventOwner(event, callerUid, callerRole as UserRole, callerEventId);
  }

  if (callerRole === 'admin') {
    return event;
  }

  // Return public view only
  return {
    id: event.id,
    name: event.name,
    date: event.date,
    startTime: event.startTime,
    locationName: event.locationName,
    totalCheckpoints: event.totalCheckpoints,
    maxTeamSize: event.maxTeamSize,
    isStarted: event.isStarted,
    isFinished: event.isFinished,
    createdAt: event.createdAt,
  } satisfies PublicEventView;
}

// ── Get Crew PIN ──────────────────────────────────────────────────────────────

/**
 * Retrieves the crewPinCode for a given event from the secrets subcollection.
 * Admin SDK read — client-side Firebase rules (`allow read, write: if false`)
 * are bypassed.  This endpoint is admin-only and rate-limited at the handler
 * layer to prevent brute-force discovery.
 */
export async function getCrewPinService(
  eventId: string,
  callerUid?: string,
  callerRole?: string,
  callerEventId?: string
): Promise<{ crewPinCode: string; marshalId: string | null }> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Event with ID '${eventId}' not found.`
    );
  }

  if (callerUid) {
    assertEventOwner(event, callerUid, callerRole as UserRole, callerEventId);
  }

  const secrets = await getEventSecrets(eventId);
  if (!secrets) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      'Event secrets not configured. Please recreate this event.'
    );
  }

  // Retrieve assigned marshalId for Attendance Station if present
  let marshalId: string | null = null;
  const checkpoints = await findCheckpointsByEvent(eventId);
  const attendanceCp = checkpoints.find((cp) => cp.isAttendanceStation);

  if (attendanceCp) {
    const db = getFirestore();

    // 1. Check if checkpoint has an assigned crew UID
    if (attendanceCp.assignedCrewUid) {
      const userSnap = await db.collection('users').doc(attendanceCp.assignedCrewUid).get();
      if (userSnap.exists) {
        const userData = userSnap.data() as UserDocument;
        marshalId = userData.id || userData.uid;
      }
    }

    // 2. Otherwise query users collection by checkpointId & eventId
    if (!marshalId) {
      const usersSnap = await db
        .collection('users')
        .where('eventId', '==', eventId)
        .where('checkpointId', '==', attendanceCp.id)
        .where('role', '==', 'crew')
        .limit(1)
        .get();

      if (!usersSnap.empty) {
        const userData = usersSnap.docs[0].data() as UserDocument;
        marshalId = userData.id || userData.uid;
      }
    }
  }

  return {
    crewPinCode: secrets.crewPinCode,
    marshalId,
  };
}

// ── Update Event ──────────────────────────────────────────────────────────────

/**
 * Updates mutable fields of an event.
 *
 * Race-integrity guards:
 *   - If the event's isStarted === true, attempts to change
 *     maxDurationSeconds or totalCheckpoints are rejected with
 *     RACE_ALREADY_STARTED (409).  All other fields remain editable
 *     (e.g. admin may correct location name or start time after launch).
 */
export async function updateEventService(
  eventId: string,
  input: UpdateEventInput,
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<EventAdminView> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Event with ID '${eventId}' not found.`
    );
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  if (event.isStarted) {
    const lockedFields: (keyof UpdateEventInput)[] = [
      'maxDurationSeconds',
      'totalCheckpoints',
    ];
    const attempted = lockedFields.filter(
      (f) => input[f] !== undefined && input[f] !== (event as unknown as Record<string, unknown>)[f]
    );
    if (attempted.length > 0) {
      throw new AppError(
        ErrorCode.RACE_ALREADY_STARTED,
        `Fields ${attempted.join(', ')} cannot be modified after race has started.`
      );
    }
  }

  // If caller is changing the join code, verify uniqueness
  if (input.joinCode && input.joinCode !== event.joinCode) {
    const existing = await findEventByJoinCode(input.joinCode);
    if (existing && existing.id !== eventId) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Join code '${input.joinCode}' is already in use.`
      );
    }
  }

  // If caller is changing the urlSlug, verify uniqueness
  if (input.urlSlug && input.urlSlug.toLowerCase() !== event.urlSlug) {
    const existing = await findEventBySlug(input.urlSlug);
    if (existing && existing.id !== eventId) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `URL slug '${input.urlSlug}' is already in use.`
      );
    }
  }

  return updateEvent(eventId, input as Partial<EventDocument>, callerUid);
}

// ── Public Safe Event Read (Unauthenticated) ──────────────────────────────────

/**
 * Unauthenticated read service returning strictly safe public subset of event data.
 */
export async function getPublicEventBySlugService(
  slug: string
): Promise<PublicSafeEventView> {
  const event = await findEventBySlug(slug);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Event with slug '${slug}' not found.`
    );
  }

  return {
    id: event.id,
    name: event.name,
    date: event.date,
    locationName: event.locationName,
    bannerImageUrl: event.bannerImageUrl ?? null,
    entryFee: event.entryFee ?? 0,
    paymentBankDetails: event.paymentBankDetails ?? '',
    paymentDetails: event.paymentDetails ?? null,
    paymentQrImageUrl: event.paymentQrImageUrl ?? null,
    maxTeamSize: event.maxTeamSize,
    urlSlug: event.urlSlug || slugify(event.name),
  };
}

/**
 * Updates structured organizer payment details for an event.
 */
export async function updatePaymentDetailsService(
  eventId: string,
  input: UpdatePaymentDetailsInput,
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<EventAdminView> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Event with ID '${eventId}' not found.`
    );
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  return updateEvent(eventId, { paymentDetails: input.paymentDetails }, callerUid);
}

// ── Upload Event Public Asset (Banner / Payment QR) ───────────────────────────

export interface EventAssetResult {
  assetUrl: string;
  storagePath: string;
  assetType: 'banner' | 'payment_qr';
  updatedAt: string;
}

/**
 * Uploads an event public asset (banner or payment QR) to Firebase Storage
 * with server-side size limit and binary magic byte validation.
 */
export async function uploadEventAssetService(
  eventId: string,
  caller: AuthenticatedUser,
  input: UploadEventAssetInput
): Promise<EventAssetResult> {
  if (caller.role !== 'admin') {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Access denied: Only admins are allowed to upload event assets.'
    );
  }

  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Event with ID '${eventId}' not found.`
    );
  }

  assertEventOwner(event, caller.uid, caller.role, caller.eventId);

  const base64Data = input.imageBase64.replace(/^data:image\/[a-z0-9-+.]+;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');

  if (imageBuffer.length === 0) {
    throw new AppError(ErrorCode.BAD_REQUEST, 'Invalid or empty image data.');
  }
  if (imageBuffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new AppError(
      ErrorCode.UNPROCESSABLE_ENTITY,
      `Image file size exceeds maximum allowed limit (5MB). Detected size: ${(
        imageBuffer.length / (1024 * 1024)
      ).toFixed(2)}MB.`
    );
  }

  const isMagicValid = validateImageMagicBytes(imageBuffer, input.contentType);
  if (!isMagicValid) {
    throw new AppError(
      ErrorCode.UNPROCESSABLE_ENTITY,
      'Image binary structure is corrupt or does not match declared MIME type.'
    );
  }

  const extension = input.contentType === 'image/png' ? 'png' : input.contentType === 'image/webp' ? 'webp' : 'jpg';
  const fileHash = crypto.randomBytes(6).toString('hex');
  const nowMs = Date.now();
  const storagePath = `events/${eventId}/public/${input.assetType}/${nowMs}_${fileHash}.${extension}`;

  const bucket = getStorageBucket();
  const file = bucket.file(storagePath);

  await file.save(imageBuffer, {
    metadata: {
      contentType: input.contentType,
      metadata: {
        eventId,
        assetType: input.assetType,
        uploadedByUid: caller.uid,
        uploadedAt: new Date(nowMs).toISOString(),
      },
    },
  });

  const [downloadUrl] = await file.getSignedUrl({
    action: 'read',
    expires: '03-01-2030',
  }).catch(() => [
    `https://storage.googleapis.com/${bucket.name}/${storagePath}`,
  ]);

  const patch: Partial<EventDocument> =
    input.assetType === 'banner'
      ? { bannerImageUrl: downloadUrl }
      : { paymentQrImageUrl: downloadUrl };

  await updateEvent(eventId, patch, caller.uid);

  return {
    assetUrl: downloadUrl,
    storagePath,
    assetType: input.assetType,
    updatedAt: new Date(nowMs).toISOString(),
  };
}

// ── Delete (Archive) Event ────────────────────────────────────────────────────

/**
 * Soft-deletes (archives) an event.
 *
 * Guard: if any team documents exist under events/{id}/teams, the
 * operation is rejected with CONFLICT (409) — data must be preserved.
 *
 * Never hard-deletes: the document and all subcollections are retained
 * for audit/leaderboard history.
 */
export async function deleteEventService(
  eventId: string,
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<void> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Event with ID '${eventId}' not found.`
    );
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  const hasTeams = await eventHasTeams(eventId);
  if (hasTeams) {
    throw new AppError(
      ErrorCode.CONFLICT,
      'This event has registered teams. Archiving is not allowed — data must be preserved.'
    );
  }

  await archiveEvent(eventId, callerUid);
}

// ── Rotate HMAC Secret (Stage 16 Security Hardening) ──────────────────────────

export interface HmacRotationResult {
  eventId: string;
  newHmacKeyId: number;
  previousHmacKeyId: number;
  rotatedAt: string;
}

/**
 * Rotates the event HMAC secret key:
 *   • Promotes current hmacSecret & hmacKeyId to previousHmacSecret & previousHmacKeyId (grace window).
 *   • Generates a new 32-byte hex secret and increments hmacKeyId.
 */
export async function rotateHmacSecretService(
  eventId: string,
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<HmacRotationResult> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Event with ID '${eventId}' not found.`
    );
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  const currentSecrets = await getEventSecrets(eventId);
  if (!currentSecrets) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Event secrets for '${eventId}' not found.`
    );
  }

  const currentKeyId = currentSecrets.hmacKeyId || 1;
  const newKeyId = currentKeyId + 1;
  const newHmacSecret = crypto.randomBytes(32).toString('hex');
  const nowIso = new Date().toISOString();

  await setEventSecrets(eventId, {
    crewPinCode: currentSecrets.crewPinCode,
    hmacSecret: newHmacSecret,
    hmacKeyId: newKeyId,
    previousHmacSecret: currentSecrets.hmacSecret,
    previousHmacKeyId: currentKeyId,
  });

  return {
    eventId,
    newHmacKeyId: newKeyId,
    previousHmacKeyId: currentKeyId,
    rotatedAt: nowIso,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Generates a unique 6-character uppercase alphanumeric join code.
 * Retries up to JOIN_CODE_MAX_RETRIES times on collision.
 * Throws INTERNAL_SERVER_ERROR if uniqueness cannot be guaranteed.
 */
async function generateUniqueJoinCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omit 0/O and 1/I (visually confusing)

  for (let attempt = 0; attempt < JOIN_CODE_MAX_RETRIES; attempt++) {
    const code = Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');

    const existing = await findEventByJoinCode(code);
    if (!existing) {
      return code;
    }
  }

  throw new AppError(
    ErrorCode.INTERNAL_SERVER_ERROR,
    'Failed to generate a unique join code. Please try again.',
    false // programmer error — alert on-call
  );
}

/** Converts text into a lowercase, URL-safe slug */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Generates a unique urlSlug for an event.
 * Retries up to JOIN_CODE_MAX_RETRIES times on collision.
 */
async function generateUniqueSlug(eventName: string): Promise<string> {
  const baseSlug = slugify(eventName) || 'event';

  for (let attempt = 0; attempt < JOIN_CODE_MAX_RETRIES; attempt++) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
    const existing = await findEventBySlug(candidate);
    if (!existing) {
      return candidate;
    }
  }

  const randomSuffix = crypto.randomBytes(2).toString('hex');
  return `${baseSlug}-${randomSuffix}`;
}

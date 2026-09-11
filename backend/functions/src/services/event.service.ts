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

import type { EventDocument } from '../models';
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
  getEventSecrets,
  setEventSecrets,
  updateEvent,
} from '../repositories/event.repository';
import type { CreateEventInput, UpdateEventInput } from '../validation';
import { AppError, ErrorCode } from '../utils/errors';

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
        `Kod penyertaan '${input.joinCode}' sudah digunakan. Sila pilih kod lain.`
      );
    }
    joinCode = input.joinCode.toUpperCase();
  } else {
    // Auto-generate a unique 6-char code
    joinCode = await generateUniqueJoinCode();
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
  callerRole: string
): Promise<ListEventsResult> {
  if (callerRole === 'admin') {
    const events = await findAllEvents();
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
 *   admin       → full document (including joinCode)
 *   crew/participant → public fields only
 */
export async function getEventService(
  eventId: string,
  callerRole: string
): Promise<EventAdminView | PublicEventView> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Acara dengan ID '${eventId}' tidak ditemui.`
    );
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
  eventId: string
): Promise<{ crewPinCode: string }> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Acara dengan ID '${eventId}' tidak ditemui.`
    );
  }

  const secrets = await getEventSecrets(eventId);
  if (!secrets) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      'Rahsia acara belum dikonfigurasi. Sila cipta semula acara ini.'
    );
  }

  return { crewPinCode: secrets.crewPinCode };
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
  callerUid: string
): Promise<EventAdminView> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Acara dengan ID '${eventId}' tidak ditemui.`
    );
  }

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
        `Medan ${attempted.join(', ')} tidak boleh diubah selepas lumba bermula.`
      );
    }
  }

  // If caller is changing the join code, verify uniqueness
  if (input.joinCode && input.joinCode !== event.joinCode) {
    const existing = await findEventByJoinCode(input.joinCode);
    if (existing && existing.id !== eventId) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Kod penyertaan '${input.joinCode}' sudah digunakan.`
      );
    }
  }

  return updateEvent(eventId, input as Partial<EventDocument>, callerUid);
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
  callerUid: string
): Promise<void> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Acara dengan ID '${eventId}' tidak ditemui.`
    );
  }

  const hasTeams = await eventHasTeams(eventId);
  if (hasTeams) {
    throw new AppError(
      ErrorCode.CONFLICT,
      'Acara ini mempunyai kumpulan berdaftar. Arkib tidak dibenarkan — data harus dikekalkan.'
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
  _callerUid: string
): Promise<HmacRotationResult> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Acara dengan ID '${eventId}' tidak ditemui.`
    );
  }

  const currentSecrets = await getEventSecrets(eventId);
  if (!currentSecrets) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Rahsia acara untuk '${eventId}' tidak ditemui.`
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
    'Gagal menjana kod penyertaan unik. Sila cuba lagi.',
    false // programmer error — alert on-call
  );
}

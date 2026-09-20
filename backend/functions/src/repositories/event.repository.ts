/**
 * repositories/event.repository.ts
 *
 * Data-access layer for the `events` Firestore collection.
 *
 * Contract:
 *   • Every method uses the Admin SDK (bypasses Firestore security rules).
 *   • Returns typed domain objects (EventDocument), never raw snapshots.
 *   • Handles Firestore Timestamp ↔ ISO-8601 string conversion at this layer
 *     so the service and handler layers work with plain strings throughout.
 *   • No auth logic, no business rules — pure CRUD + query.
 *
 * Collection path:  events/{eventId}
 * Secrets path:     events/{eventId}/secrets/config   (Admin SDK only)
 */

import * as admin from 'firebase-admin';

import { getFirestore } from '../config/firebase';
import type { EventDocument, EventSecretsDocument } from '../models';

// ── Collection paths ──────────────────────────────────────────────────────────

const EVENTS_COLLECTION = 'events';
const SECRETS_DOC = 'config';

// ── Public-field projection for non-admin callers ─────────────────────────────

/**
 * Fields visible to crew and participant roles.
 * joinCode is deliberately excluded — participants already have it (they used
 * it to join); crews never need it.  Sensitive scheduling details are also
 * stripped so competitors cannot infer advantage.
 */
export type PublicEventView = Pick<
  EventDocument,
  | 'id'
  | 'name'
  | 'date'
  | 'startTime'
  | 'locationName'
  | 'totalCheckpoints'
  | 'maxTeamSize'
  | 'isStarted'
  | 'isFinished'
  | 'createdAt'
>;

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Convert a raw Firestore document snapshot to a typed EventDocument. */
function toEventDocument(
  snap: admin.firestore.DocumentSnapshot
): EventDocument {
  const data = snap.data() as Omit<EventDocument, 'id'>;

  return {
    ...data,
    id: snap.id,
    // Normalise Firestore Timestamps → ISO strings at the boundary
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    startedAt: data.startedAt ? toIso(data.startedAt) : null,
  };
}

function toIso(value: unknown): string {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

// ── Repository ────────────────────────────────────────────────────────────────

/**
 * Creates a new event document.
 *
 * @param data   Full event payload (id already excluded — Firestore auto-ids).
 * @param uid    UID of the admin performing the creation.
 * @returns      The created EventDocument with the generated Firestore ID.
 */
export async function createEvent(
  data: Omit<EventDocument, 'id' | 'createdAt' | 'updatedAt'>,
  uid: string
): Promise<EventDocument> {
  const db = getFirestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const docRef = db.collection(EVENTS_COLLECTION).doc();
  const writeData = {
    ...data,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(writeData);

  // Re-fetch to get server timestamps resolved
  const snap = await docRef.get();
  return toEventDocument(snap);
}

/**
 * Stores the event secrets document in the deny-all subcollection.
 * Only the Admin SDK can write here — client SDK calls are blocked by
 * `allow read, write: if false` in firestore.rules.
 */
export async function setEventSecrets(
  eventId: string,
  secrets: Omit<EventSecretsDocument, 'createdAt' | 'updatedAt'>
): Promise<void> {
  const db = getFirestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection('secrets')
    .doc(SECRETS_DOC)
    .set({ ...secrets, createdAt: now, updatedAt: now });
}

/**
 * Reads the crewPinCode from the deny-all secrets subcollection.
 * Admin SDK bypasses rules — no client can call this directly.
 *
 * Returns null if the secrets document doesn't exist yet.
 */
export async function getEventSecrets(
  eventId: string
): Promise<EventSecretsDocument | null> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection('secrets')
    .doc(SECRETS_DOC)
    .get();

  if (!snap.exists) {
    return null;
  }
  return snap.data() as EventSecretsDocument;
}

/**
 * Fetches a single event by its Firestore document ID.
 * Returns null if not found or soft-deleted (isArchived).
 */
export async function findEventById(
  id: string,
  includeArchived = false
): Promise<EventDocument | null> {
  const db = getFirestore();
  const snap = await db.collection(EVENTS_COLLECTION).doc(id).get();

  if (!snap.exists) {
    return null;
  }

  const event = toEventDocument(snap);

  if (!includeArchived && (event as EventDocument & { isArchived?: boolean }).isArchived) {
    return null;
  }

  return event;
}

/**
 * Returns ALL non-archived events ordered by creation date descending.
 * Used for the admin list view.
 */
export async function findAllEvents(): Promise<EventDocument[]> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .where('isArchived', '==', false)
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map(toEventDocument);
}

/**
 * Returns non-archived events created by a specific owner UID.
 * Used for role-scoped admin event list views.
 */
export async function findEventsByOwner(ownerUid: string): Promise<EventDocument[]> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .where('createdBy', '==', ownerUid)
    .where('isArchived', '==', false)
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map(toEventDocument);
}

/**
 * Returns active (non-started, non-finished, non-archived) events.
 * Used for the crew/participant list view — public fields only.
 */
export async function findActiveEvents(): Promise<PublicEventView[]> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .where('isStarted', '==', false)
    .where('isFinished', '==', false)
    .where('isArchived', '==', false)
    .orderBy('date', 'asc')
    .get();

  return snap.docs.map((d) => {
    const ev = toEventDocument(d);
    return {
      id: ev.id,
      name: ev.name,
      date: ev.date,
      startTime: ev.startTime,
      locationName: ev.locationName,
      totalCheckpoints: ev.totalCheckpoints,
      maxTeamSize: ev.maxTeamSize,
      isStarted: ev.isStarted,
      isFinished: ev.isFinished,
      createdAt: ev.createdAt,
    } satisfies PublicEventView;
  });
}

/**
 * Looks up an event by its join code (case-insensitive, stored uppercase).
 * Used for uniqueness validation on event creation.
 */
export async function findEventByJoinCode(
  joinCode: string
): Promise<EventDocument | null> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .where('joinCode', '==', joinCode.toUpperCase())
    .where('isArchived', '==', false)
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }

  return toEventDocument(snap.docs[0]);
}

/**
 * Looks up an event by its urlSlug.
 * Used for uniqueness validation and public endpoint resolution.
 */
export async function findEventBySlug(
  slug: string
): Promise<EventDocument | null> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .where('urlSlug', '==', slug.toLowerCase())
    .where('isArchived', '==', false)
    .limit(1)
    .get();

  if (!snap.empty) {
    return toEventDocument(snap.docs[0]);
  }

  // Fallback 1: Check if slug is directly an event document ID
  const docSnap = await db.collection(EVENTS_COLLECTION).doc(slug).get();
  if (docSnap.exists) {
    const event = toEventDocument(docSnap);
    if (!event.isArchived) {
      return event;
    }
  }

  // Fallback 2: Check if slug matches joinCode
  const joinCodeSnap = await db
    .collection(EVENTS_COLLECTION)
    .where('joinCode', '==', slug.toUpperCase())
    .where('isArchived', '==', false)
    .limit(1)
    .get();

  if (!joinCodeSnap.empty) {
    return toEventDocument(joinCodeSnap.docs[0]);
  }

  return null;
}

/**
 * Updates mutable fields of an event document.
 * Caller is responsible for enforcing race-start guards before calling this.
 */
export async function updateEvent(
  id: string,
  patch: Partial<Omit<EventDocument, 'id' | 'createdAt' | 'createdBy'>>,
  updatedBy: string
): Promise<EventDocument> {
  const db = getFirestore();
  const docRef = db.collection(EVENTS_COLLECTION).doc(id);

  await docRef.update({
    ...patch,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy,
  });

  const snap = await docRef.get();
  return toEventDocument(snap);
}

/**
 * Soft-deletes an event by setting isArchived = true.
 * The document is preserved for audit; teams and subcollections remain intact.
 */
export async function archiveEvent(
  id: string,
  archivedBy: string
): Promise<void> {
  const db = getFirestore();
  await db.collection(EVENTS_COLLECTION).doc(id).update({
    isArchived: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: archivedBy,
  });
}

/**
 * Returns true if any team documents exist under this event.
 * Used to guard against archiving events with active team registrations.
 */
export async function eventHasTeams(eventId: string): Promise<boolean> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection('teams')
    .limit(1)
    .get();

  return !snap.empty;
}

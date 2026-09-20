/**
 * repositories/preregistration.repository.ts
 *
 * Data-access layer for the `events/{eventId}/preRegistrations` Firestore subcollection.
 *
 * Subcollection path: events/{eventId}/preRegistrations/{preRegId}
 */

import * as admin from 'firebase-admin';

import { getFirestore } from '../config/firebase';
import type { PreRegistrationDocument, PreRegistrationStatus } from '../models';

const EVENTS_COLLECTION = 'events';
const PREREGISTRATIONS_SUBCOLLECTION = 'preRegistrations';

function toIso(value: unknown): string {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

function toPreRegistrationDocument(
  snap: admin.firestore.DocumentSnapshot
): PreRegistrationDocument {
  const data = snap.data() as Omit<PreRegistrationDocument, 'id'>;

  return {
    ...data,
    id: snap.id,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    submittedAt: toIso(data.submittedAt),
  };
}

/**
 * Retrieves a single pre-registration by ID within an event.
 */
export async function findPreRegistrationById(
  eventId: string,
  id: string
): Promise<PreRegistrationDocument | null> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(PREREGISTRATIONS_SUBCOLLECTION)
    .doc(id)
    .get();

  if (!snap.exists) {
    return null;
  }

  return toPreRegistrationDocument(snap);
}

/**
 * Lists pre-registrations for an event, optionally filtered by status.
 * Ordered by submittedAt descending.
 */
export async function listPreRegistrations(
  eventId: string,
  status?: PreRegistrationStatus
): Promise<PreRegistrationDocument[]> {
  const db = getFirestore();
  let query: admin.firestore.Query = db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(PREREGISTRATIONS_SUBCOLLECTION);

  if (status) {
    query = query.where('status', '==', status);
  }

  query = query.orderBy('submittedAt', 'desc');

  const snap = await query.get();
  return snap.docs.map((doc) => toPreRegistrationDocument(doc));
}

/**
 * Updates a pre-registration document.
 */
export async function updatePreRegistration(
  eventId: string,
  id: string,
  data: Partial<PreRegistrationDocument>
): Promise<PreRegistrationDocument> {
  const db = getFirestore();
  const docRef = db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(PREREGISTRATIONS_SUBCOLLECTION)
    .doc(id);

  const now = admin.firestore.FieldValue.serverTimestamp();

  await docRef.update({
    ...data,
    updatedAt: now,
  });

  const updatedSnap = await docRef.get();
  return toPreRegistrationDocument(updatedSnap);
}

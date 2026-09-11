/**
 * repositories/checkpoint.repository.ts
 *
 * Data-access layer for the `events/{eventId}/checkpoints` Firestore subcollection.
 *
 * Contract:
 *   • Uses Admin SDK (bypasses Firestore security rules).
 *   • Returns typed domain objects (CheckpointDocument), never raw snapshots.
 *   • Normalises Firestore Timestamps to ISO strings.
 *   • Pure CRUD + query.
 *
 * Subcollection path: events/{eventId}/checkpoints/{checkpointId}
 */

import * as admin from 'firebase-admin';

import { getFirestore } from '../config/firebase';
import type { CheckpointDocument } from '../models';

const EVENTS_COLLECTION = 'events';
const CHECKPOINTS_SUBCOLLECTION = 'checkpoints';

// ── Internal Helpers ──────────────────────────────────────────────────────────

function toCheckpointDocument(
  snap: admin.firestore.DocumentSnapshot
): CheckpointDocument {
  const data = snap.data() as Omit<CheckpointDocument, 'id'>;

  return {
    ...data,
    id: snap.id,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
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

// ── Repository Functions ──────────────────────────────────────────────────────

/**
 * Creates a new checkpoint document in the specified event.
 */
export async function createCheckpoint(
  eventId: string,
  data: Omit<CheckpointDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CheckpointDocument> {
  const db = getFirestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const docRef = db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(CHECKPOINTS_SUBCOLLECTION)
    .doc();

  const writeData = {
    ...data,
    eventId,
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(writeData);

  const snap = await docRef.get();
  return toCheckpointDocument(snap);
}

/**
 * Finds a checkpoint by its ID within an event.
 */
export async function findCheckpointById(
  eventId: string,
  checkpointId: string
): Promise<CheckpointDocument | null> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(CHECKPOINTS_SUBCOLLECTION)
    .doc(checkpointId)
    .get();

  if (!snap.exists) {
    return null;
  }

  return toCheckpointDocument(snap);
}

/**
 * Retrieves all checkpoints for a given event, ordered by orderIndex ascending.
 */
export async function findCheckpointsByEvent(
  eventId: string
): Promise<CheckpointDocument[]> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(CHECKPOINTS_SUBCOLLECTION)
    .orderBy('orderIndex', 'asc')
    .get();

  return snap.docs.map(toCheckpointDocument);
}

/**
 * Updates mutable fields on a checkpoint document.
 */
export async function updateCheckpoint(
  eventId: string,
  checkpointId: string,
  patch: Partial<Omit<CheckpointDocument, 'id' | 'createdAt' | 'eventId'>>,
  updatedBy?: string
): Promise<CheckpointDocument> {
  const db = getFirestore();
  const docRef = db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(CHECKPOINTS_SUBCOLLECTION)
    .doc(checkpointId);

  await docRef.update({
    ...patch,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(updatedBy ? { updatedBy } : {}),
  });

  const snap = await docRef.get();
  return toCheckpointDocument(snap);
}

/**
 * Bulk updates the orderIndex across multiple checkpoints within an event.
 */
export async function bulkUpdateCheckpointOrder(
  eventId: string,
  orderUpdates: Array<{ id: string; orderIndex: number }>,
  updatedBy?: string
): Promise<void> {
  const db = getFirestore();
  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const item of orderUpdates) {
    const docRef = db
      .collection(EVENTS_COLLECTION)
      .doc(eventId)
      .collection(CHECKPOINTS_SUBCOLLECTION)
      .doc(item.id);

    batch.update(docRef, {
      orderIndex: item.orderIndex,
      updatedAt: now,
      ...(updatedBy ? { updatedBy } : {}),
    });
  }

  await batch.commit();
}

/**
 * Deletes a checkpoint document.
 */
export async function deleteCheckpoint(
  eventId: string,
  checkpointId: string
): Promise<void> {
  const db = getFirestore();
  await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(CHECKPOINTS_SUBCOLLECTION)
    .doc(checkpointId)
    .delete();
}

/**
 * repositories/team.repository.ts
 *
 * Data-access layer for the `events/{eventId}/teams` Firestore subcollection.
 *
 * Contract:
 *   • Every method uses the Admin SDK.
 *   • Returns typed domain objects (TeamDocument), never raw snapshots.
 *   • Handles Firestore Timestamp ↔ ISO-8601 string conversion.
 *   • No auth logic, no business rules — pure CRUD + query.
 *
 * Subcollection path: events/{eventId}/teams/{teamId}
 */

import * as admin from 'firebase-admin';

import { getFirestore } from '../config/firebase';
import type { TeamDocument, TeamStatus } from '../models';

const EVENTS_COLLECTION = 'events';
const TEAMS_SUBCOLLECTION = 'teams';

// ── Public Projection for non-privileged callers ──────────────────────────────

/**
 * Strips sensitive contact information (phone, full member list)
 * when returned to non-admin/crew callers.
 */
export type PublicTeamView = Pick<
  TeamDocument,
  | 'id'
  | 'name'
  | 'status'
  | 'memberCount'
  | 'leaderName'
  | 'startCheckpointId'
  | 'currentCheckpointId'
  | 'completedCheckpointIds'
  | 'skippedCheckpointIds'
  | 'totalPoints'
  | 'penaltiesMinutes'
  | 'isDNF'
  | 'isDisqualified'
  | 'eventId'
  | 'createdAt'
>;

// ── Internal Helpers ──────────────────────────────────────────────────────────

function toTeamDocument(
  snap: admin.firestore.DocumentSnapshot
): TeamDocument {
  const data = snap.data() as Omit<TeamDocument, 'id'>;

  return {
    ...data,
    id: snap.id,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    finishedAt: data.finishedAt ? toIso(data.finishedAt) : null,
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
 * Creates a new team document in the specified event.
 */
export async function createTeam(
  eventId: string,
  data: Omit<TeamDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TeamDocument> {
  const db = getFirestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const docRef = db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(TEAMS_SUBCOLLECTION)
    .doc();

  const writeData = {
    ...data,
    eventId,
    createdAt: now,
    updatedAt: now,
  };

  await docRef.set(writeData);

  const snap = await docRef.get();
  return toTeamDocument(snap);
}

/**
 * Finds a team by its ID within an event.
 */
export async function findTeamById(
  eventId: string,
  teamId: string
): Promise<TeamDocument | null> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(TEAMS_SUBCOLLECTION)
    .doc(teamId)
    .get();

  if (!snap.exists) {
    return null;
  }

  return toTeamDocument(snap);
}

/**
 * Finds a team by name (case-insensitive) within an event.
 */
export async function findTeamByName(
  eventId: string,
  name: string
): Promise<TeamDocument | null> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(TEAMS_SUBCOLLECTION)
    .get();

  const normalised = name.trim().toLowerCase();
  const matching = snap.docs.find(
    (d) => ((d.data()['name'] as string) || '').trim().toLowerCase() === normalised
  );

  if (!matching) {
    return null;
  }

  return toTeamDocument(matching);
}

/**
 * Retrieves all teams for a given event, ordered by creation date descending.
 */
export async function findTeamsByEvent(
  eventId: string
): Promise<TeamDocument[]> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(TEAMS_SUBCOLLECTION)
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map(toTeamDocument);
}

/**
 * Retrieves approved teams for a given event.
 */
export async function findApprovedTeams(
  eventId: string
): Promise<TeamDocument[]> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(TEAMS_SUBCOLLECTION)
    .where('status', '==', 'approved')
    .get();

  return snap.docs.map(toTeamDocument);
}

/**
 * Updates mutable fields on a team document.
 */
export async function updateTeam(
  eventId: string,
  teamId: string,
  patch: Partial<Omit<TeamDocument, 'id' | 'createdAt' | 'eventId'>>,
  updatedBy?: string
): Promise<TeamDocument> {
  const db = getFirestore();
  const docRef = db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(TEAMS_SUBCOLLECTION)
    .doc(teamId);

  await docRef.update({
    ...patch,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(updatedBy ? { updatedBy } : {}),
  });

  const snap = await docRef.get();
  return toTeamDocument(snap);
}

/**
 * Updates the status of a team document.
 */
export async function updateTeamStatus(
  eventId: string,
  teamId: string,
  status: TeamStatus,
  updatedBy: string
): Promise<TeamDocument> {
  return updateTeam(eventId, teamId, { status }, updatedBy);
}

/**
 * Deletes a team document.
 */
export async function deleteTeam(
  eventId: string,
  teamId: string
): Promise<void> {
  const db = getFirestore();
  await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(TEAMS_SUBCOLLECTION)
    .doc(teamId)
    .delete();
}

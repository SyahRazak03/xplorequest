/**
 * services/leaderboard.service.ts
 *
 * Stage 12: Live Leaderboard & Incremental Scoring Engine.
 *
 * Features:
 *   1. REST read path for live leaderboard with dynamic rank assignment and Malaysian time formatting.
 *   2. Single-team incremental leaderboard document synchronization (zero lock contention across teams).
 */

import * as admin from 'firebase-admin';

import { getFirestore } from '../config/firebase';
import type { LeaderboardDocument, LeaderboardEntry } from '../models';

const EVENTS_COLLECTION = 'events';
const LEADERBOARD_SUBCOLLECTION = 'leaderboard';

/**
 * Formats total seconds into Malaysian localized time string (e.g. "1j 42m" or "42m 15s").
 */
export function formatMalaysianTime(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}j ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Fetches ranked leaderboard entries for an event.
 * Computes dynamic rank (1..N) based on sorted metrics:
 *   1. isDNF (false before true)
 *   2. totalPoints DESC
 *   3. penaltiesMinutes ASC
 *   4. totalTimeSeconds ASC
 *   5. finishedAt ASC
 */
export async function getLeaderboardService(eventId: string): Promise<LeaderboardEntry[]> {
  const db = getFirestore();
  const leaderboardRef = db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(LEADERBOARD_SUBCOLLECTION);

  const snapshot = await leaderboardRef.get();
  if (snapshot.empty) {
    return [];
  }

  const docs = snapshot.docs.map((doc) => doc.data() as LeaderboardDocument);

  // Dynamic sorting
  docs.sort((a, b) => {
    // DNF teams always sorted at the bottom
    if (a.isDNF !== b.isDNF) {
      return a.isDNF ? 1 : -1;
    }
    // 1. Total Points (descending)
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    // 2. Penalties in Minutes (ascending)
    if (a.penaltiesMinutes !== b.penaltiesMinutes) {
      return a.penaltiesMinutes - b.penaltiesMinutes;
    }
    // 3. Total Time in Seconds (ascending)
    if (a.totalTimeSeconds !== b.totalTimeSeconds) {
      return a.totalTimeSeconds - b.totalTimeSeconds;
    }
    // 4. Finished At timestamp (ascending)
    const timeA = a.finishedAt ? new Date(a.finishedAt).getTime() : Infinity;
    const timeB = b.finishedAt ? new Date(b.finishedAt).getTime() : Infinity;
    return timeA - timeB;
  });

  // Assign dynamic rank & format totalTimeFormatted
  return docs.map((doc, index) => ({
    teamId: doc.teamId,
    teamName: doc.teamName,
    rank: index + 1,
    totalPoints: doc.totalPoints || 0,
    totalTimeSeconds: doc.totalTimeSeconds || 0,
    totalTimeFormatted: formatMalaysianTime(doc.totalTimeSeconds || 0),
    penaltiesMinutes: doc.penaltiesMinutes || 0,
    isDNF: Boolean(doc.isDNF),
    checkpointsCompleted: doc.checkpointsCompleted || 0,
    checkpointsSkipped: doc.checkpointsSkipped || 0,
    status: doc.status || 'active',
    finishedAt: doc.finishedAt || null,
  }));
}

export interface SyncLeaderboardInput {
  teamId: string;
  teamName: string;
  totalPoints: number;
  totalTimeSeconds: number;
  penaltiesMinutes: number;
  isDNF: boolean;
  checkpointsCompleted: number;
  checkpointsSkipped: number;
  status: 'active' | 'finished' | 'dnf';
  finishedAt?: string | null;
  startedAt?: string | null;
  callerUid?: string;
}

/**
 * Single-team incremental document write to events/{eventId}/leaderboard/{teamId}.
 * Zero lock contention across teams!
 */
export async function syncTeamLeaderboardService(
  eventId: string,
  input: SyncLeaderboardInput,
  transaction?: admin.firestore.Transaction
): Promise<void> {
  const db = getFirestore();
  const leaderboardDocRef = db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(LEADERBOARD_SUBCOLLECTION)
    .doc(input.teamId);

  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
  const payload: Partial<LeaderboardDocument> = {
    eventId,
    teamId: input.teamId,
    teamName: input.teamName,
    totalPoints: input.totalPoints,
    totalTimeSeconds: input.totalTimeSeconds,
    penaltiesMinutes: input.penaltiesMinutes,
    isDNF: input.isDNF,
    checkpointsCompleted: input.checkpointsCompleted,
    checkpointsSkipped: input.checkpointsSkipped,
    status: input.status,
    finishedAt: input.finishedAt || null,
    startedAt: input.startedAt || null,
    updatedAt: serverTimestamp as unknown as string,
    updatedBy: input.callerUid || 'system',
  };

  if (transaction) {
    transaction.set(leaderboardDocRef, payload, { merge: true });
  } else {
    await leaderboardDocRef.set(payload, { merge: true });
  }
}

/**
 * jobs/timeoutEvaluator.ts
 *
 * Stage 12: Scheduled Cloud Function (`evaluateRaceTimeouts`).
 * Runs every minute to evaluate max race duration timeouts and auto-flag teams as DNF.
 */

import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { getFirestore } from '../config/firebase';
import type { EventDocument, TeamDocument } from '../models';
import { DEFAULT_RACE_RULES } from '../services/rules.service';

const EVENTS_COLLECTION = 'events';
const TEAMS_SUBCOLLECTION = 'teams';
const LEADERBOARD_SUBCOLLECTION = 'leaderboard';
const SCAN_LOGS_SUBCOLLECTION = 'scanLogs';

/**
 * Scheduled job: Runs every 1 minute to check for teams exceeding maxRaceTime.
 */
export const evaluateRaceTimeouts = onSchedule(
  {
    schedule: 'every 1 minutes',
    region: 'asia-southeast1',
    timeZone: 'Asia/Kuala_Lumpur',
  },
  async () => {
    const db = getFirestore();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // Query active events (isStarted == true && isFinished == false)
    const activeEventsSnap = await db
      .collection(EVENTS_COLLECTION)
      .where('isStarted', '==', true)
      .where('isFinished', '==', false)
      .get();

    if (activeEventsSnap.empty) {
      return;
    }

    for (const eventDoc of activeEventsSnap.docs) {
      const eventId = eventDoc.id;
      const eventData = eventDoc.data() as EventDocument;
      const rules = { ...DEFAULT_RACE_RULES, ...(eventData.rules || {}) };
      const maxRaceTimeSeconds = rules.maxRaceTime;

      // Query active teams in this event (isFinished == false, isDNF == false)
      const activeTeamsSnap = await eventDoc.ref
        .collection(TEAMS_SUBCOLLECTION)
        .where('isFinished', '==', false)
        .where('isDNF', '==', false)
        .get();

      if (activeTeamsSnap.empty) {
        continue;
      }

      for (const teamDoc of activeTeamsSnap.docs) {
        const teamData = teamDoc.data() as TeamDocument;

        // Fallback chain for start time timestamp
        let raceStartMs = 0;
        if (teamData.startedAt) {
          raceStartMs = new Date(teamData.startedAt).getTime();
        } else if (eventData.startedAt) {
          raceStartMs = new Date(eventData.startedAt).getTime();
        } else if ((eventData as unknown as { raceStartTime?: number }).raceStartTime) {
          raceStartMs = (eventData as unknown as { raceStartTime: number }).raceStartTime;
        }

        // Safety Guard: If raceStartMs ends up at 0 / invalid (all fallbacks missing),
        // skip this team for this cycle to prevent false DNF flagging!
        if (!raceStartMs || raceStartMs === 0 || isNaN(raceStartMs)) {
          continue;
        }

        const elapsedSeconds = Math.floor((nowMs - raceStartMs) / 1000);

        if (elapsedSeconds > maxRaceTimeSeconds) {
          // Flag team as DNF
          const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
          const teamRef = teamDoc.ref;
          const leaderboardRef = eventDoc.ref
            .collection(LEADERBOARD_SUBCOLLECTION)
            .doc(teamDoc.id);

          await db.runTransaction(async (tx) => {
            tx.update(teamRef, {
              isDNF: true,
              totalTimeSeconds: elapsedSeconds,
              updatedAt: serverTimestamp,
              updatedBy: 'system_timeout_evaluator',
            });

            tx.set(
              leaderboardRef,
              {
                eventId,
                teamId: teamDoc.id,
                teamName: teamData.name,
                totalPoints: teamData.totalPoints || 0,
                totalTimeSeconds: elapsedSeconds,
                penaltiesMinutes: teamData.penaltiesMinutes || 0,
                isDNF: true,
                checkpointsCompleted: Array.isArray(teamData.completedCheckpointIds)
                  ? teamData.completedCheckpointIds.length
                  : 0,
                checkpointsSkipped: Array.isArray(teamData.skippedCheckpointIds)
                  ? teamData.skippedCheckpointIds.length
                  : 0,
                status: 'dnf',
                startedAt: teamData.startedAt || eventData.startedAt || null,
                updatedAt: serverTimestamp as unknown as string,
                updatedBy: 'system_timeout_evaluator',
              },
              { merge: true }
            );

            // Audit ScanLog
            const scanLogRef = eventDoc.ref.collection(SCAN_LOGS_SUBCOLLECTION).doc();
            tx.set(scanLogRef, {
              id: scanLogRef.id,
              eventId,
              teamId: teamDoc.id,
              status: 'dnf_timeout',
              scannedAt: nowIso,
              rejectionReason: `Max race time exceeded (${elapsedSeconds}s > ${maxRaceTimeSeconds}s)`,
              createdAt: serverTimestamp,
              updatedAt: serverTimestamp,
            });
          });
        }
      }
    }
  }
);

/**
 * jobs/gpsPurgeJob.ts
 *
 * Stage 16: Ephemeral GPS Data Purge Scheduled Cloud Function (`purgeEphemeralGpsData`).
 * Enforces Stage 2 PDPA minimization by deleting lastScanLat/lastScanLng/lastScanAt/lastScanLocation
 * from team documents once an event has finished.
 */

import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { getFirestore } from '../config/firebase';

const EVENTS_COLLECTION = 'events';
const TEAMS_SUBCOLLECTION = 'teams';

/**
 * Core business logic for purging ephemeral GPS location data from finished event teams.
 * Extracted so it can be directly unit-tested.
 */
export async function processGpsPurge(): Promise<number> {
  const db = getFirestore();
  let totalPurgedTeams = 0;

  // Query finished events
  const finishedEventsSnap = await db
    .collection(EVENTS_COLLECTION)
    .where('isFinished', '==', true)
    .get();

  if (finishedEventsSnap.empty) {
    return 0;
  }

  for (const eventDoc of finishedEventsSnap.docs) {
    const teamsSnap = await eventDoc.ref
      .collection(TEAMS_SUBCOLLECTION)
      .get();

    if (teamsSnap.empty) {
      continue;
    }

    for (const teamDoc of teamsSnap.docs) {
      const teamData = teamDoc.data();

      // Check if any ephemeral GPS fields exist
      if (
        teamData['lastScanLat'] !== undefined ||
        teamData['lastScanLng'] !== undefined ||
        teamData['lastScanAt'] !== undefined ||
        teamData['lastScanLocation'] !== undefined
      ) {
        await teamDoc.ref.update({
          lastScanLat: admin.firestore.FieldValue.delete(),
          lastScanLng: admin.firestore.FieldValue.delete(),
          lastScanAt: admin.firestore.FieldValue.delete(),
          lastScanLocation: admin.firestore.FieldValue.delete(),
        });
        totalPurgedTeams++;
      }
    }
  }

  return totalPurgedTeams;
}

/**
 * Scheduled job running daily to purge ephemeral GPS records.
 */
export const purgeEphemeralGpsData = onSchedule(
  {
    schedule: 'every 24 hours',
    region: 'asia-southeast1',
    timeZone: 'Asia/Kuala_Lumpur',
  },
  async () => {
    try {
      const purgedCount = await processGpsPurge();
      logger.info(`Pembersihan data lokasi GPS PDPA selesai. ${purgedCount} kumpulan dibersihkan.`);
    } catch (err) {
      logger.error('Ralat semasa pembersihan data lokasi GPS PDPA:', err);
    }
  }
);

/**
 * jobs/gpsPurgeJob.ts
 *
 * Ephemeral GPS Data & PDPA IP Purge Scheduled Cloud Function (`purgeEphemeralGpsData`).
 * Enforces Stage 2 PDPA minimization by deleting lastScanLat/lastScanLng/lastScanAt/lastScanLocation
 * from team documents and ipAddress from preRegistrations once an event has finished.
 */

import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { getFirestore } from '../config/firebase';

const EVENTS_COLLECTION = 'events';
const TEAMS_SUBCOLLECTION = 'teams';
const PREREGISTRATIONS_SUBCOLLECTION = 'preRegistrations';

/**
 * Core business logic for purging ephemeral GPS location data and IP addresses from finished events.
 * Extracted so it can be directly unit-tested.
 */
export async function processGpsPurge(): Promise<number> {
  const db = getFirestore();
  let totalPurgedRecords = 0;

  // Query finished events
  const finishedEventsSnap = await db
    .collection(EVENTS_COLLECTION)
    .where('isFinished', '==', true)
    .get();

  if (finishedEventsSnap.empty) {
    return 0;
  }

  for (const eventDoc of finishedEventsSnap.docs) {
    // 1. Purge team GPS fields
    const teamsSnap = await eventDoc.ref
      .collection(TEAMS_SUBCOLLECTION)
      .get();

    if (!teamsSnap.empty) {
      for (const teamDoc of teamsSnap.docs) {
        const teamData = teamDoc.data();

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
          totalPurgedRecords++;
        }
      }
    }

    // 2. Purge preRegistrations ipAddress fields (PDPA Data Minimization)
    const preRegsSnap = await eventDoc.ref
      .collection(PREREGISTRATIONS_SUBCOLLECTION)
      .get();

    if (!preRegsSnap.empty) {
      for (const preRegDoc of preRegsSnap.docs) {
        const preRegData = preRegDoc.data();

        if (preRegData['ipAddress'] !== undefined) {
          await preRegDoc.ref.update({
            ipAddress: admin.firestore.FieldValue.delete(),
          });
          totalPurgedRecords++;
        }
      }
    }
  }

  return totalPurgedRecords;
}

/**
 * Scheduled job running daily to purge ephemeral GPS and IP records.
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
      logger.info(`Pembersihan data lokasi GPS & IP PDPA selesai. ${purgedCount} rekod dibersihkan.`);
    } catch (err) {
      logger.error('Ralat semasa pembersihan data lokasi GPS & IP PDPA:', err);
    }
  }
);

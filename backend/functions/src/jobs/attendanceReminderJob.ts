/**
 * jobs/attendanceReminderJob.ts
 *
 * Stage 15: Scheduled Cloud Function (`sendAttendanceReminders`).
 * Runs every 15 minutes to send push notification reminders to teams that haven't checked in yet.
 */

import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { getFirestore } from '../config/firebase';
import type { EventDocument, TeamDocument } from '../models';
import { notifyTeam } from '../services/notification.service';

const EVENTS_COLLECTION = 'events';
const TEAMS_SUBCOLLECTION = 'teams';

/**
 * Core business logic for sending attendance reminders.
 * Extracted so it can be directly unit-tested without Cloud Functions v2 scheduler wrapper.
 */
export async function processAttendanceReminders(): Promise<void> {
  const db = getFirestore();

  // Query active/upcoming events that have not started yet
  const upcomingEventsSnap = await db
    .collection(EVENTS_COLLECTION)
    .where('isStarted', '==', false)
    .where('isFinished', '==', false)
    .get();

  if (upcomingEventsSnap.empty) {
    return;
  }

  for (const eventDoc of upcomingEventsSnap.docs) {
    const eventId = eventDoc.id;
    const eventData = eventDoc.data() as EventDocument;

    // Query approved teams for this event
    const teamsSnap = await eventDoc.ref
      .collection(TEAMS_SUBCOLLECTION)
      .where('status', '==', 'approved')
      .get();

    if (teamsSnap.empty) {
      continue;
    }

    for (const teamDoc of teamsSnap.docs) {
      const teamData = teamDoc.data() as TeamDocument;

      // Skip teams that are already present or excluded
      if (
        teamData.isPresent === true ||
        teamData.attendanceStatus === 'present' ||
        teamData.isExcluded === true
      ) {
        continue;
      }

      const title = 'Peringatan Pendaftaran Kehadiran';
      const body = `Sila mendaftar kehadiran kumpulan anda (${teamData.name}) untuk acara ${eventData.name ?? 'XploreQuest'} di kaunter pendaftaran.`;
      const data = {
        eventId,
        type: 'attendance_reminder',
        teamId: teamDoc.id,
      };

      try {
        await notifyTeam(eventId, teamDoc.id, title, body, data);
      } catch (err) {
        logger.error(`Ralat peringatan kehadiran untuk kumpulan ${teamDoc.id}:`, err);
      }
    }
  }
}

/**
 * Scheduled job export pinned to asia-southeast1.
 */
export const sendAttendanceReminders = onSchedule(
  {
    schedule: 'every 15 minutes',
    region: 'asia-southeast1',
    timeZone: 'Asia/Kuala_Lumpur',
  },
  processAttendanceReminders
);

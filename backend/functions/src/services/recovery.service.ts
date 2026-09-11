/**
 * services/recovery.service.ts
 *
 * Stage 14: FR-10 Session Recovery Engine Services.
 *
 * Provides team state rehydration for participant dashboard recovery
 * after app crashes, battery drains, or device switches.
 */

import { getFirestore } from '../config/firebase';
import type { AuthenticatedUser } from '../middleware/auth';
import type {
  CheckpointDocument,
  EventDocument,
  TeamDocument,
  TeamStateResponse,
} from '../models';
import { AppError, ErrorCode } from '../utils/errors';

const EVENTS_COLLECTION = 'events';
const TEAMS_SUBCOLLECTION = 'teams';
const CHECKPOINTS_SUBCOLLECTION = 'checkpoints';

/**
 * Reuses Stage 12's exact 3-way fallback chain for race start timestamp:
 * 1. teamData.startedAt
 * 2. eventData.startedAt
 * 3. eventData.raceStartTime
 */
export function resolveRaceStartMs(
  teamData: TeamDocument,
  eventData: EventDocument
): number {
  if (teamData.startedAt) {
    return new Date(teamData.startedAt).getTime();
  }
  if (eventData.startedAt) {
    return new Date(eventData.startedAt).getTime();
  }
  if ((eventData as unknown as { raceStartTime?: number }).raceStartTime) {
    return (eventData as unknown as { raceStartTime: number }).raceStartTime;
  }
  return 0;
}

/**
 * Returns the full active race state for a team to rehydrate ParticipantDashboardScreen.
 * Enforces strict role-based and team-scoped authorization.
 */
export async function getTeamStateService(
  eventId: string,
  teamId: string,
  caller: AuthenticatedUser
): Promise<TeamStateResponse> {
  // 1. Authorization Guard
  if (caller.role === 'participant') {
    if (caller.teamId !== teamId || caller.eventId !== eventId) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Akses ditolak: Anda hanya boleh mengakses status kumpulan anda sendiri.'
      );
    }
  } else if (caller.role === 'crew') {
    if (caller.eventId !== eventId) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Akses ditolak: Kru hanya boleh mengakses status bagi acara yang ditugaskan.'
      );
    }
  }

  const db = getFirestore();
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const teamRef = eventRef.collection(TEAMS_SUBCOLLECTION).doc(teamId);

  const [eventSnap, teamSnap] = await Promise.all([
    eventRef.get(),
    teamRef.get(),
  ]);

  if (!eventSnap.exists) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
  }
  const eventData = eventSnap.data() as EventDocument;

  if (!teamSnap.exists) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Kumpulan tidak ditemui.');
  }
  const teamData = teamSnap.data() as TeamDocument;

  // 2. Hydrate active current checkpoint if set
  let currentCheckpointObj: TeamStateResponse['currentCheckpoint'] = null;
  const currentCpId = teamData.currentCheckpointId;

  if (currentCpId) {
    const cpSnap = await eventRef
      .collection(CHECKPOINTS_SUBCOLLECTION)
      .doc(currentCpId)
      .get();

    if (cpSnap.exists) {
      const cpData = cpSnap.data() as CheckpointDocument;
      currentCheckpointObj = {
        id: cpSnap.id,
        name: cpData.name || cpSnap.id,
        clueText: cpData.clueText || '',
        taskDescription: cpData.taskDescription || '',
        scorePoints: cpData.scorePoints || 0,
        latitude: cpData.latitude,
        longitude: cpData.longitude,
        geofenceRadiusMeters: cpData.geofenceRadiusMeters || 50,
        isStart: cpData.isStart || false,
        isFinish: cpData.isFinish || false,
      };
    }
  }

  // 3. Timing Metrics via 3-way fallback chain
  const nowMs = Date.now();
  const raceStartMs = resolveRaceStartMs(teamData, eventData);
  const isTeamFinished = Boolean(teamData.isFinished || teamData.finishedAt);

  let finishMs = nowMs;
  if (isTeamFinished && teamData.finishedAt) {
    finishMs = new Date(teamData.finishedAt).getTime();
  }

  let elapsedSeconds = 0;
  if (teamData.totalTimeSeconds !== undefined && isTeamFinished) {
    elapsedSeconds = teamData.totalTimeSeconds;
  } else if (raceStartMs > 0) {
    elapsedSeconds = Math.max(0, Math.floor((finishMs - raceStartMs) / 1000));
  }

  const maxDurationSeconds = eventData.maxDurationSeconds || 7200;
  const remainingSeconds = isTeamFinished
    ? 0
    : Math.max(0, maxDurationSeconds - elapsedSeconds);

  return {
    teamId: teamSnap.id,
    teamName: teamData.name,
    eventId,
    eventName: eventData.name,
    status: teamData.status,
    currentCheckpointId: currentCpId || '',
    currentCheckpoint: currentCheckpointObj,
    completedCheckpointIds: Array.isArray(teamData.completedCheckpointIds)
      ? teamData.completedCheckpointIds
      : [],
    skippedCheckpointIds: Array.isArray(teamData.skippedCheckpointIds)
      ? teamData.skippedCheckpointIds
      : [],
    assignedSequence: Array.isArray(teamData.assignedSequence)
      ? teamData.assignedSequence
      : [],
    totalPoints: teamData.totalPoints || 0,
    penaltiesMinutes: teamData.penaltiesMinutes || 0,
    penaltyPoints: teamData.penaltyPoints || 0,
    isStarted: Boolean(eventData.isStarted || teamData.startedAt),
    isFinished: isTeamFinished,
    finishedAt: teamData.finishedAt || null,
    startedAt: teamData.startedAt || eventData.startedAt || null,
    maxDurationSeconds,
    elapsedSeconds,
    remainingSeconds,
    isDNF: Boolean(teamData.isDNF),
    isDisqualified: Boolean(teamData.isDisqualified),
  };
}

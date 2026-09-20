/**
 * services/rules.service.ts
 *
 * Stage 12: Admin Race Rules Configuration Service.
 * Allows administrators to configure event race rules dynamically.
 */

import * as admin from 'firebase-admin';

import { getFirestore } from '../config/firebase';
import type { AuthenticatedUser } from '../middleware/auth';
import type { EventDocument, RaceRules } from '../models';
import { assertEventOwner } from './event.service';
import { AppError, ErrorCode } from '../utils/errors';
import type { UpdateRaceRulesInput } from '../validation';

const EVENTS_COLLECTION = 'events';

export const DEFAULT_RACE_RULES: RaceRules = {
  maxRaceTime: 7200, // 2 hours default
  taskTimeLimit: 900, // 15 mins default
  latePenaltyMin: 10,
  pointPenaltyPts: 50,
  bonusPoints: 0,
  pointsSystemEnabled: true,
  latePenaltyEnabled: true,
  taskTimeLimitEnabled: true,
  pointPenaltyEnabled: true,
  bonusPointsEnabled: true,
  maxVelocityKmh: 40,
  maxSkipsPerTeam: 2,
  latePenaltyPerMinute: 5,
};

export async function updateRaceRulesService(
  eventId: string,
  caller: AuthenticatedUser,
  input: UpdateRaceRulesInput
): Promise<RaceRules> {
  if (caller.role !== 'admin') {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Akses ditolak: Hanya pentadbir (admin) yang dibenarkan mengemas kini peraturan perlumbaan.'
    );
  }

  const db = getFirestore();
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);

  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
  }

  const eventData = eventSnap.data() as EventDocument;
  assertEventOwner(eventData, caller.uid, caller.role, caller.eventId);
  const currentRules: RaceRules = {
    ...DEFAULT_RACE_RULES,
    ...(eventData.rules || {}),
  };

  const updatedRules: RaceRules = {
    ...currentRules,
    ...input,
  };

  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

  await eventRef.update({
    rules: updatedRules,
    updatedAt: serverTimestamp,
    updatedBy: caller.uid,
  });

  return updatedRules;
}

/**
 * services/verification.service.ts
 *
 * Stage 11: Crew Verification Wizard Services.
 *
 * Features:
 *   1. Photo Proof Upload (FR-08) to Firebase Storage with server-side size/MIME validation.
 *   2. Manual Checkpoint Override with geofence audit compliance.
 *   3. Manual Point & Time Penalties bounded by RaceRules.
 */

import * as crypto from 'crypto';

import * as admin from 'firebase-admin';

import { getFirestore, getStorageBucket } from '../config/firebase';
import type { AuthenticatedUser } from '../middleware/auth';
import type {
  CheckpointDocument,
  EventDocument,
  TeamDocument,
} from '../models';
import { findEventById } from '../repositories/event.repository';
import { assertEventOwner } from './event.service';
import { AppError, ErrorCode } from '../utils/errors';
import { haversineDistanceMeters } from '../utils/geometry';
import type {
  ApplyPenaltyInput,
  ManualOverrideInput,
  UploadPhotoProofInput,
} from '../validation';

import { MAX_IMAGE_SIZE_BYTES, validateImageMagicBytes } from '../utils/image';

const EVENTS_COLLECTION = 'events';
const TEAMS_SUBCOLLECTION = 'teams';
const CHECKPOINTS_SUBCOLLECTION = 'checkpoints';
const SCAN_LOGS_SUBCOLLECTION = 'scanLogs';
const PROOFS_SUBCOLLECTION = 'photoProofs';

export interface PhotoProofResult {
  photoProofUrl: string;
  storagePath: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface ManualOverrideResult {
  teamId: string;
  checkpointId: string;
  nextCheckpointId: string;
  completedCheckpointIds: string[];
  pointsAwarded: number;
  totalPoints: number;
  verifiedBy: 'manual';
  crewUid: string;
  reason: string;
  geofenceAudited: boolean;
}

export interface ApplyPenaltyResult {
  teamId: string;
  penaltyType: 'points' | 'time' | 'both';
  pointPenalty: number;
  timePenaltyMinutes: number;
  newTotalPoints: number;
  newTotalPenaltiesMinutes: number;
  appliedByUid: string;
  reason: string;
}

// ── 1. Upload Photo Proof (FR-08) ─────────────────────────────────────────────

export async function uploadPhotoProofService(
  eventId: string,
  checkpointId: string,
  teamId: string,
  caller: AuthenticatedUser,
  input: UploadPhotoProofInput
): Promise<PhotoProofResult> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
  }

  assertEventOwner(event, caller.uid, caller.role, caller.eventId);

  // Authorization check: Admin or Assigned Crew
  if (caller.role === 'crew') {
    if (caller.eventId !== eventId || caller.checkpointId !== checkpointId) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Access denied: Crew can only upload photo proof for their assigned checkpoint.'
      );
    }
  }

  // Strip Base64 header prefix if passed by client
  const base64Data = input.imageBase64.replace(/^data:image\/[a-z0-9-+.]+;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');

  // Server-side Size Validation
  if (imageBuffer.length === 0) {
    throw new AppError(ErrorCode.BAD_REQUEST, 'Invalid or empty image data.');
  }
  if (imageBuffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new AppError(
      ErrorCode.UNPROCESSABLE_ENTITY,
      `Image file size exceeds maximum allowed limit (5MB). Detected size: ${(
        imageBuffer.length / (1024 * 1024)
      ).toFixed(2)}MB.`
    );
  }

  // Server-side MIME & Magic Bytes Validation
  const isMagicValid = validateImageMagicBytes(imageBuffer, input.contentType);
  if (!isMagicValid) {
    throw new AppError(
      ErrorCode.UNPROCESSABLE_ENTITY,
      'Image binary structure is corrupt or does not match declared MIME type.'
    );
  }

  const extension = input.contentType === 'image/png' ? 'png' : input.contentType === 'image/webp' ? 'webp' : 'jpg';
  const fileHash = crypto.randomBytes(6).toString('hex');
  const nowMs = Date.now();
  const storagePath = `proofs/${eventId}/${teamId}/${checkpointId}/${nowMs}_${fileHash}.${extension}`;

  const bucket = getStorageBucket();
  const file = bucket.file(storagePath);

  await file.save(imageBuffer, {
    metadata: {
      contentType: input.contentType,
      metadata: {
        eventId,
        checkpointId,
        teamId,
        uploadedByUid: caller.uid,
        uploadedAt: new Date(nowMs).toISOString(),
        latitude: input.latitude ? String(input.latitude) : '',
        longitude: input.longitude ? String(input.longitude) : '',
      },
    },
  });

  // Public/Storage URL
  const [downloadUrl] = await file.getSignedUrl({
    action: 'read',
    expires: '03-01-2030',
  }).catch(() => [
    `https://storage.googleapis.com/${bucket.name}/${storagePath}`,
  ]);

  const db = getFirestore();
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const teamRef = eventRef.collection(TEAMS_SUBCOLLECTION).doc(teamId);
  const photoProofRef = eventRef.collection(PROOFS_SUBCOLLECTION).doc();
  const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
  const nowIso = new Date(nowMs).toISOString();

  await db.runTransaction(async (tx) => {
    tx.set(photoProofRef, {
      id: photoProofRef.id,
      eventId,
      checkpointId,
      teamId,
      photoUrl: downloadUrl,
      storagePath,
      sizeBytes: imageBuffer.length,
      contentType: input.contentType,
      uploadedByUid: caller.uid,
      uploadedAt: nowIso,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    tx.update(teamRef, {
      photoProofUrl: downloadUrl,
      updatedAt: serverTimestamp,
      updatedBy: caller.uid,
    });
  });

  return {
    photoProofUrl: downloadUrl,
    storagePath,
    sizeBytes: imageBuffer.length,
    uploadedAt: nowIso,
  };
}

// ── 2. Manual Checkpoint Override ─────────────────────────────────────────────

// ── 2. Manual Checkpoint Override ─────────────────────────────────────────────

export async function processOverrideCore(
  eventId: string,
  checkpointId: string,
  teamId: string,
  caller: AuthenticatedUser,
  input: ManualOverrideInput,
  options?: { transaction?: admin.firestore.Transaction }
): Promise<ManualOverrideResult> {
  // Authorization check: Admin or Assigned Crew ONLY
  if (caller.role === 'participant') {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Access denied: Participants are not allowed to perform manual clearance.'
    );
  }
  if (caller.role === 'crew') {
    if (caller.eventId !== eventId || caller.checkpointId !== checkpointId) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Access denied: Crew can only perform manual clearance for their assigned checkpoint.'
      );
    }
  }

  const db = getFirestore();
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const teamRef = eventRef.collection(TEAMS_SUBCOLLECTION).doc(teamId);
  const checkpointRef = eventRef.collection(CHECKPOINTS_SUBCOLLECTION).doc(checkpointId);

  const runLogic = async (tx: admin.firestore.Transaction) => {
    const [eventSnap, teamSnap, cpSnap] = await Promise.all([
      tx.get(eventRef),
      tx.get(teamRef),
      tx.get(checkpointRef),
    ]);

    if (!eventSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
    }
    const eventData = eventSnap.data() as EventDocument;
    assertEventOwner({ ...eventData, id: eventId }, caller.uid, caller.role, caller.eventId);

    if (!eventData.isStarted) {
      throw new AppError(ErrorCode.RACE_NOT_STARTED, 'Race has not started yet.');
    }
    if (eventData.isFinished) {
      throw new AppError(ErrorCode.FORBIDDEN, 'This event has ended.');
    }

    if (!teamSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Team not found.');
    }
    const teamData = teamSnap.data() as TeamDocument;

    if (teamData.isDisqualified || teamData.isExcluded) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Team is disqualified or excluded.');
    }
    if (teamData.finishedAt) {
      throw new AppError(ErrorCode.CONFLICT, 'Team has completed the race.');
    }

    if (!cpSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Checkpoint not found.');
    }
    const cpData = cpSnap.data() as CheckpointDocument;

    const completedList = Array.isArray(teamData.completedCheckpointIds)
      ? teamData.completedCheckpointIds
      : [];
    const skippedList = Array.isArray(teamData.skippedCheckpointIds)
      ? teamData.skippedCheckpointIds
      : [];

    if (completedList.includes(checkpointId)) {
      throw new AppError(
        ErrorCode.CHECKPOINT_ALREADY_COMPLETED,
        'This checkpoint has already been completed by this team.'
      );
    }

    const isCurrent = teamData.currentCheckpointId === checkpointId;
    const isPreviouslySkipped = skippedList.includes(checkpointId);

    if (!isCurrent && !isPreviouslySkipped) {
      throw new AppError(
        ErrorCode.OUT_OF_SEQUENCE,
        `This checkpoint is not the team's current route sequence and has not been skipped. Current CP: ${teamData.currentCheckpointId}.`
      );
    }

    // ── Geofence Anti-Cheat Constraint ────────────────────────────────────────
    let geofenceAudited = false;
    if (input.crewLatitude !== undefined && input.crewLongitude !== undefined) {
      const distanceMeters = haversineDistanceMeters(
        input.crewLatitude,
        input.crewLongitude,
        cpData.latitude,
        cpData.longitude
      );
      const allowedRadius = cpData.geofenceRadiusMeters || 50;
      if (distanceMeters <= allowedRadius) {
        geofenceAudited = true;
      }
    }

    // If geofence wasn't passed via valid crew GPS, explicit skip audit reason is mandatory
    if (!geofenceAudited && (!input.skipGeofenceReason || input.skipGeofenceReason.trim().length < 5)) {
      throw new AppError(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Geofence exception reason (at least 5 characters) is required when crew is outside radius or GPS location is not provided.'
      );
    }

    const assignedSequence = Array.isArray(teamData.assignedSequence)
      ? teamData.assignedSequence
      : [];

    const updatedCompletedList = [...completedList, checkpointId];
    const updatedSkippedList = skippedList.filter((id) => id !== checkpointId);

    // Sequence progress
    let nextCheckpointId = teamData.currentCheckpointId;
    if (nextCheckpointId === checkpointId) {
      const currentIndex = assignedSequence.indexOf(checkpointId);
      if (currentIndex !== -1 && currentIndex + 1 < assignedSequence.length) {
        nextCheckpointId = assignedSequence[currentIndex + 1]!;
      } else {
        nextCheckpointId = checkpointId;
      }
    }

    const pointsAwarded = input.pointsAwarded !== undefined ? input.pointsAwarded : cpData.scorePoints || 0;
    const finalTotalPoints = (teamData.totalPoints || 0) + pointsAwarded;

    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const nowIso = new Date().toISOString();

    // 1. Update Team
    tx.update(teamRef, {
      completedCheckpointIds: updatedCompletedList,
      skippedCheckpointIds: updatedSkippedList,
      currentCheckpointId: nextCheckpointId,
      totalPoints: finalTotalPoints,
      updatedAt: serverTimestamp,
      updatedBy: caller.uid,
    });

    // 2. Write Audit ScanLog
    const scanLogRef = eventRef.collection(SCAN_LOGS_SUBCOLLECTION).doc();
    tx.set(scanLogRef, {
      id: scanLogRef.id,
      eventId,
      checkpointId,
      teamId,
      status: 'verified',
      scanType: 'manual_crew',
      verifiedBy: 'manual',
      scannedByUid: caller.uid,
      rejectionReason: `Manual Override: ${input.reason}${!geofenceAudited ? ` | Geofence Skipped: ${input.skipGeofenceReason}` : ''}`,
      latitude: input.crewLatitude || null,
      longitude: input.crewLongitude || null,
      pointsAwarded,
      scannedAt: nowIso,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    return {
      teamId,
      checkpointId,
      nextCheckpointId,
      completedCheckpointIds: updatedCompletedList,
      pointsAwarded,
      totalPoints: finalTotalPoints,
      verifiedBy: 'manual' as const,
      crewUid: caller.uid,
      reason: input.reason,
      geofenceAudited,
    };
  };

  if (options?.transaction) {
    return runLogic(options.transaction);
  }
  return db.runTransaction(runLogic);
}

export async function manualOverrideService(
  eventId: string,
  checkpointId: string,
  teamId: string,
  caller: AuthenticatedUser,
  input: ManualOverrideInput
): Promise<ManualOverrideResult> {
  return processOverrideCore(eventId, checkpointId, teamId, caller, input);
}

// ── 3. Manual Penalty Application ─────────────────────────────────────────────

export async function processPenaltyCore(
  eventId: string,
  teamId: string,
  caller: AuthenticatedUser,
  input: ApplyPenaltyInput,
  options?: { transaction?: admin.firestore.Transaction }
): Promise<ApplyPenaltyResult> {
  // Authorization check: Admin or Crew ONLY
  if (caller.role === 'participant') {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Access denied: Participants are not allowed to apply penalties.'
    );
  }
  if (caller.role === 'crew') {
    if (caller.eventId !== eventId) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Access denied: Crew can only apply penalties for their assigned event.'
      );
    }
  }

  const db = getFirestore();
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const teamRef = eventRef.collection(TEAMS_SUBCOLLECTION).doc(teamId);

  const runLogic = async (tx: admin.firestore.Transaction) => {
    const [eventSnap, teamSnap] = await Promise.all([
      tx.get(eventRef),
      tx.get(teamRef),
    ]);

    if (!eventSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
    }
    const eventData = eventSnap.data() as EventDocument;
    assertEventOwner({ ...eventData, id: eventId }, caller.uid, caller.role, caller.eventId);

    if (!teamSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Team not found.');
    }
    const teamData = teamSnap.data() as TeamDocument;

    const pointPenalty = input.pointPenalty ?? 0;
    const timePenaltyMinutes = input.timePenaltyMinutes ?? 0;

    // Crew-role Bounded Penalty Enforcement against RaceRules
    if (caller.role === 'crew') {
      const maxAllowedPointPenalty = eventData.rules?.pointPenaltyPts ?? 50;
      const maxAllowedTimePenalty = eventData.rules?.latePenaltyMin ?? 30;

      if (pointPenalty > maxAllowedPointPenalty) {
        throw new AppError(
          ErrorCode.UNPROCESSABLE_ENTITY,
          `Maximum allowed point penalty by crew is ${maxAllowedPointPenalty} points. Requested value: ${pointPenalty}.`
        );
      }
      if (timePenaltyMinutes > maxAllowedTimePenalty) {
        throw new AppError(
          ErrorCode.UNPROCESSABLE_ENTITY,
          `Maximum allowed time penalty by crew is ${maxAllowedTimePenalty} minutes. Requested value: ${timePenaltyMinutes}.`
        );
      }
    }

    const newPenaltyPoints = (teamData.penaltyPoints || 0) + pointPenalty;
    const newTotalPoints = Math.max(0, (teamData.totalPoints || 0) - pointPenalty);
    const newTotalPenaltiesMinutes = (teamData.penaltiesMinutes || 0) + timePenaltyMinutes;

    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const nowIso = new Date().toISOString();

    // 1. Update Team Document
    tx.update(teamRef, {
      penaltyPoints: newPenaltyPoints,
      totalPoints: newTotalPoints,
      penaltiesMinutes: newTotalPenaltiesMinutes,
      updatedAt: serverTimestamp,
      updatedBy: caller.uid,
    });

    // 2. Update Leaderboard entry if exists
    const leaderboardRef = eventRef.collection('leaderboard').doc(teamId);
    tx.set(
      leaderboardRef,
      {
        teamId,
        points: newTotalPoints,
        penaltiesMinutes: newTotalPenaltiesMinutes,
        updatedAt: serverTimestamp,
      },
      { merge: true }
    );

    // 3. Write Penalty Audit Log
    const scanLogRef = eventRef.collection(SCAN_LOGS_SUBCOLLECTION).doc();
    tx.set(scanLogRef, {
      id: scanLogRef.id,
      eventId,
      checkpointId: input.checkpointId || null,
      teamId,
      status: 'penalty_applied',
      scanType: 'manual_crew',
      scannedByUid: caller.uid,
      penaltyApplied: pointPenalty,
      penaltyMinutesApplied: timePenaltyMinutes,
      rejectionReason: `Penalty Applied (${input.penaltyType}): ${input.reason}`,
      scannedAt: nowIso,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    return {
      teamId,
      penaltyType: input.penaltyType,
      pointPenalty,
      timePenaltyMinutes,
      newTotalPoints,
      newTotalPenaltiesMinutes,
      appliedByUid: caller.uid,
      reason: input.reason,
    };
  };

  if (options?.transaction) {
    return runLogic(options.transaction);
  }
  return db.runTransaction(runLogic);
}

export async function applyPenaltyService(
  eventId: string,
  teamId: string,
  caller: AuthenticatedUser,
  input: ApplyPenaltyInput
): Promise<ApplyPenaltyResult> {
  return processPenaltyCore(eventId, teamId, caller, input);
}

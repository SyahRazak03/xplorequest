/**
 * services/scan.service.ts
 *
 * Multi-layer participant QR scan verification pipeline.
 * PRD Security Layers 1, 2, 3, and 5 & FYP FR-01, FR-02.
 */

import * as admin from 'firebase-admin';

import { getFirestore } from '../config/firebase';
import type { AuthenticatedUser } from '../middleware/auth';
import type {
  CheckpointDocument,
  EventDocument,
  QrTokenDocument,
  TeamDocument,
} from '../models';
import { getEventSecrets } from '../repositories/event.repository';
import { verifyHmacSignature } from '../utils/crypto';
import { AppError, ErrorCode } from '../utils/errors';
import {
  calculateVelocityKmh,
  haversineDistanceMeters,
  isPointInsidePolygon,
} from '../utils/geometry';
import type {
  FinishRaceScanInput,
  ScanCheckpointQrInput,
  SkipCheckpointInput,
} from '../validation';

const EVENTS_COLLECTION = 'events';
const TEAMS_SUBCOLLECTION = 'teams';
const CHECKPOINTS_SUBCOLLECTION = 'checkpoints';
const QR_TOKENS_SUBCOLLECTION = 'qr_tokens';
const SCAN_LOGS_SUBCOLLECTION = 'scanLogs';

export interface ScanVerificationResult {
  teamId: string;
  checkpointId: string;
  nextCheckpointId: string;
  isFinish: boolean;
  pointsEarned: number;
  totalPoints: number;
  completedCheckpointIds: string[];
  skippedCheckpointIds?: string[];
  scannedAt: string;
}

export interface SkipCheckpointResult {
  teamId: string;
  skippedCheckpointId: string;
  nextCheckpointId: string;
  skippedCheckpointIds: string[];
  remainingSkips: number;
}

export interface FinishRaceResult {
  teamId: string;
  isFinished: true;
  finishedAt: string;
  elapsedSeconds: number;
  totalPoints: number;
  penaltyPointsApplied: number;
  completedCheckpointIds: string[];
}

/**
 * Validates and processes a participant's checkpoint QR scan in a single atomic transaction.
 * Supports both normal sequence checkpoints and re-visiting previously-skipped checkpoints.
 */
export async function processScanCore(
  eventId: string,
  teamId: string,
  caller: AuthenticatedUser,
  input: ScanCheckpointQrInput,
  checkpointIdTarget?: string,
  options?: { transaction?: admin.firestore.Transaction }
): Promise<ScanVerificationResult> {
  if (!['participant', 'crew', 'admin'].includes(caller.role as string)) {
    throw new AppError(ErrorCode.FORBIDDEN, 'Akses ditolak: Peranan tidak dibenarkan.');
  }

  // ── Step 1: Parse and Cryptographically Verify HMAC Signature ───────────────
  const payloadParts = input.payload.split(':');
  if (payloadParts.length !== 5) {
    throw new AppError(
      ErrorCode.INVALID_PAYLOAD,
      'Format payload kod QR tidak sah.'
    );
  }

  const [qrTeamId, qrCheckpointId, qrTimestampStr, qrKeyIdStr, qrSignature] =
    payloadParts as [string, string, string, string, string];

  const checkpointId = checkpointIdTarget || qrCheckpointId;
  if (qrCheckpointId !== checkpointId) {
    throw new AppError(
      ErrorCode.BAD_REQUEST,
      `Kod QR ini adalah untuk ${qrCheckpointId}, bukan pos kawalan ${checkpointId}.`
    );
  }

  const secrets = await getEventSecrets(eventId);
  if (!secrets || !secrets.hmacSecret) {
    throw new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Kunci rahsia acara tidak ditemui.'
    );
  }

  const keyId = parseInt(qrKeyIdStr, 10);
  let secretToUse = secrets.hmacSecret;

  if (keyId === secrets.hmacKeyId) {
    secretToUse = secrets.hmacSecret;
  } else if (
    secrets.previousHmacKeyId &&
    keyId === secrets.previousHmacKeyId &&
    secrets.previousHmacSecret
  ) {
    secretToUse = secrets.previousHmacSecret;
  } else {
    throw new AppError(
      ErrorCode.INVALID_SIGNATURE,
      'Kunci HMAC tidak sah atau versi kunci telah tamat tempoh.'
    );
  }

  const rawDataToVerify = `${qrTeamId}:${qrCheckpointId}:${qrTimestampStr}:${qrKeyIdStr}`;
  const isSignatureValid = verifyHmacSignature(
    rawDataToVerify,
    qrSignature,
    secretToUse
  );

  if (!isSignatureValid) {
    throw new AppError(
      ErrorCode.INVALID_SIGNATURE,
      'Tandatangan kriptografi kod QR tidak sah (Tampered).'
    );
  }

  const db = getFirestore();
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const teamRef = eventRef.collection(TEAMS_SUBCOLLECTION).doc(teamId);
  const checkpointRef = eventRef
    .collection(CHECKPOINTS_SUBCOLLECTION)
    .doc(checkpointId);
  const qrTokenRef = eventRef
    .collection(QR_TOKENS_SUBCOLLECTION)
    .doc(qrSignature);

  const runLogic = async (tx: admin.firestore.Transaction) => {
    const [eventSnap, teamSnap, cpSnap, qrTokenSnap] = await Promise.all([
      tx.get(eventRef),
      tx.get(teamRef),
      tx.get(checkpointRef),
      tx.get(qrTokenRef),
    ]);

    if (!eventSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
    }
    const eventData = eventSnap.data() as EventDocument;

    if (!eventData.isStarted) {
      throw new AppError(
        ErrorCode.RACE_NOT_STARTED,
        'Perlumbaan untuk acara ini belum bermula.'
      );
    }
    if (eventData.isFinished) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Acara ini telah tamat.');
    }

    if (!cpSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Pos kawalan tidak ditemui.');
    }
    const cpData = cpSnap.data() as CheckpointDocument;

    if (!teamSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Kumpulan tidak ditemui.');
    }
    const teamData = teamSnap.data() as TeamDocument;

    if (teamData.isDisqualified) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Kumpulan anda telah dibatalkan penyertaan (Disqualified).'
      );
    }
    if (teamData.isExcluded) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Kumpulan anda telah dikecualikan daripada perlumbaan.'
      );
    }
    if (teamData.finishedAt) {
      throw new AppError(
        ErrorCode.CONFLICT,
        'Kumpulan anda telah menamatkan perlumbaan.'
      );
    }

    if (!qrTokenSnap.exists) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Rekod token kod QR tidak ditemui atau telah dipadam.'
      );
    }
    const tokenData = qrTokenSnap.data() as QrTokenDocument;
    const nowMs = Date.now();

    if (tokenData.expiresAt !== null && tokenData.expiresAt < nowMs) {
      throw new AppError(
        ErrorCode.TOKEN_EXPIRED,
        'Kod QR telah tamat tempoh. Sila minta kod QR baharu daripada kru.'
      );
    }

    const redeemedList = Array.isArray(tokenData.redeemedByTeamIds)
      ? tokenData.redeemedByTeamIds
      : [];

    if (tokenData.teamId === '*') {
      if (redeemedList.includes(teamId)) {
        throw new AppError(
          ErrorCode.REPLAY_ATTACK,
          'Kod QR stesen ini telah pun diimbas oleh kumpulan anda.'
        );
      }
    } else {
      if (tokenData.scanned === true || redeemedList.includes(teamId)) {
        throw new AppError(
          ErrorCode.REPLAY_ATTACK,
          'Kod QR ini telah pun digunakan (Replay attack dikesan).'
        );
      }
    }

    if (tokenData.teamId !== '*' && tokenData.teamId !== teamId) {
      throw new AppError(
        ErrorCode.WRONG_TEAM,
        `Kod QR ini dijana khusus untuk kumpulan ${tokenData.teamId}, bukan kumpulan anda.`
      );
    }

    const completedList = Array.isArray(teamData.completedCheckpointIds)
      ? teamData.completedCheckpointIds
      : [];
    const skippedList = Array.isArray(teamData.skippedCheckpointIds)
      ? teamData.skippedCheckpointIds
      : [];

    if (completedList.includes(checkpointId)) {
      throw new AppError(
        ErrorCode.CHECKPOINT_ALREADY_COMPLETED,
        'Pos kawalan ini telah pun diselesaikan oleh kumpulan anda.'
      );
    }

    const isCurrent = teamData.currentCheckpointId === checkpointId;
    const isPreviouslySkipped = skippedList.includes(checkpointId);

    if (!isCurrent && !isPreviouslySkipped) {
      throw new AppError(
        ErrorCode.OUT_OF_SEQUENCE,
        `Pos kawalan ini bukan giliran laluan semasa kumpulan anda dan belum dilangkau. Pos semasa: ${teamData.currentCheckpointId}.`
      );
    }

    if (
      eventData.geofenceBoundary &&
      eventData.geofenceBoundary.length >= 3
    ) {
      const isInsideEventBoundary = isPointInsidePolygon(
        { latitude: input.latitude, longitude: input.longitude },
        eventData.geofenceBoundary
      );
      if (!isInsideEventBoundary) {
        throw new AppError(
          ErrorCode.OUT_OF_EVENT_BOUNDARY,
          'Lokasi GPS anda berada di luar kawasan sempadan acara.'
        );
      }
    }

    const distanceMeters = haversineDistanceMeters(
      input.latitude,
      input.longitude,
      cpData.latitude,
      cpData.longitude
    );
    const allowedRadiusMeters = cpData.geofenceRadiusMeters || 50;

    if (distanceMeters > allowedRadiusMeters) {
      throw new AppError(
        ErrorCode.OUT_OF_CHECKPOINT_RADIUS,
        `Lokasi GPS anda (${Math.round(distanceMeters)}m) berada di luar radius pos kawalan (${allowedRadiusMeters}m).`
      );
    }

    if (
      teamData.lastScanLat !== undefined &&
      teamData.lastScanLng !== undefined &&
      teamData.lastScanAt !== undefined
    ) {
      const distFromLastMeters = haversineDistanceMeters(
        teamData.lastScanLat,
        teamData.lastScanLng,
        input.latitude,
        input.longitude
      );
      const timeDeltaSeconds = Math.max(1, (nowMs - teamData.lastScanAt) / 1000);
      const velocityKmh = calculateVelocityKmh(distFromLastMeters, timeDeltaSeconds);
      const maxVelocityKmh = eventData.rules?.maxVelocityKmh ?? 40;

      if (velocityKmh > maxVelocityKmh) {
        throw new AppError(
          ErrorCode.SUSPECTED_SPOOFING,
          `Kelajuan pergerakan tidak munasabah (${Math.round(velocityKmh)} km/j > had ${maxVelocityKmh} km/j). Penipuan GPS disyaki.`
        );
      }
    }

    const assignedSequence = Array.isArray(teamData.assignedSequence)
      ? teamData.assignedSequence
      : [];
    const updatedCompletedList = [...completedList, checkpointId];

    let nextCheckpointId: string;
    let isFinish = false;
    let updatedSkippedList = skippedList;

    if (isPreviouslySkipped) {
      updatedSkippedList = skippedList.filter((id) => id !== checkpointId);
      nextCheckpointId = teamData.currentCheckpointId;
      if (nextCheckpointId === checkpointId) {
        const currentIndex = assignedSequence.indexOf(checkpointId);
        if (currentIndex !== -1 && currentIndex + 1 < assignedSequence.length) {
          nextCheckpointId = assignedSequence[currentIndex + 1]!;
        } else {
          nextCheckpointId = checkpointId;
          isFinish = true;
        }
      }
    } else {
      const currentIndex = assignedSequence.indexOf(checkpointId);
      if (currentIndex !== -1 && currentIndex + 1 < assignedSequence.length) {
        nextCheckpointId = assignedSequence[currentIndex + 1]!;
      } else {
        nextCheckpointId = checkpointId;
        isFinish = true;
      }
    }

    const pointsEarned =
      eventData.rules?.pointsSystemEnabled !== false
        ? cpData.scorePoints || 0
        : 0;
    const totalPoints = (teamData.totalPoints || 0) + pointsEarned;
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const nowIso = new Date(nowMs).toISOString();

    tx.update(teamRef, {
      lastScanLat: input.latitude,
      lastScanLng: input.longitude,
      lastScanAt: nowMs,
      completedCheckpointIds: updatedCompletedList,
      skippedCheckpointIds: updatedSkippedList,
      currentCheckpointId: nextCheckpointId,
      totalPoints,
      updatedAt: serverTimestamp,
      updatedBy: caller.uid,
    });

    const updatedRedeemed = [...redeemedList, teamId];
    tx.update(qrTokenRef, {
      redeemedByTeamIds: updatedRedeemed,
      scanned: tokenData.teamId !== '*' ? true : tokenData.scanned,
      scannedAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    const scanLogRef = eventRef.collection(SCAN_LOGS_SUBCOLLECTION).doc();
    tx.set(scanLogRef, {
      id: scanLogRef.id,
      eventId,
      checkpointId,
      teamId,
      status: 'verified',
      scannedAt: nowIso,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy || null,
      pointsAwarded: pointsEarned,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    return {
      teamId,
      checkpointId,
      nextCheckpointId,
      isFinish,
      pointsEarned,
      totalPoints,
      completedCheckpointIds: updatedCompletedList,
      skippedCheckpointIds: updatedSkippedList,
      scannedAt: nowIso,
    };
  };

  if (options?.transaction) {
    return runLogic(options.transaction);
  }
  return db.runTransaction(runLogic);
}

/**
 * Validates and processes a participant's checkpoint QR scan in a single atomic transaction.
 */
export async function verifyAndProcessScanService(
  eventId: string,
  checkpointId: string,
  caller: AuthenticatedUser,
  input: ScanCheckpointQrInput
): Promise<ScanVerificationResult> {
  const teamId = caller.teamId;
  if (!teamId) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Akses ditolak: Pengguna mestilah ahli kumpulan yang sah.'
    );
  }
  return processScanCore(eventId, teamId, caller, input, checkpointId);
}

export async function processSkipCore(
  eventId: string,
  teamId: string,
  caller: AuthenticatedUser,
  checkpointId: string,
  options?: { transaction?: admin.firestore.Transaction; reason?: string }
): Promise<SkipCheckpointResult> {
  if (!['participant', 'crew', 'admin'].includes(caller.role as string)) {
    throw new AppError(ErrorCode.FORBIDDEN, 'Akses ditolak: Peranan tidak dibenarkan.');
  }

  const db = getFirestore();
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const teamRef = eventRef.collection(TEAMS_SUBCOLLECTION).doc(teamId);
  const checkpointRef = eventRef
    .collection(CHECKPOINTS_SUBCOLLECTION)
    .doc(checkpointId);

  const runLogic = async (tx: admin.firestore.Transaction) => {
    const [eventSnap, teamSnap, cpSnap] = await Promise.all([
      tx.get(eventRef),
      tx.get(teamRef),
      tx.get(checkpointRef),
    ]);

    if (!eventSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
    }
    const eventData = eventSnap.data() as EventDocument;

    if (!eventData.isStarted) {
      throw new AppError(
        ErrorCode.RACE_NOT_STARTED,
        'Perlumbaan untuk acara ini belum bermula.'
      );
    }
    if (eventData.isFinished) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Acara ini telah tamat.');
    }

    if (!teamSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Kumpulan tidak ditemui.');
    }
    const teamData = teamSnap.data() as TeamDocument;

    if (teamData.isDisqualified || teamData.isExcluded || teamData.finishedAt) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Kumpulan tidak dibenarkan melangkau pos kawalan.'
      );
    }

    if (!cpSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Pos kawalan tidak ditemui.');
    }
    const cpData = cpSnap.data() as CheckpointDocument;

    if (cpData.isFinish) {
      throw new AppError(
        ErrorCode.CANNOT_SKIP_FINISH,
        'Pos penamat tidak boleh dilangkau.'
      );
    }

    const assignedSequence = Array.isArray(teamData.assignedSequence)
      ? teamData.assignedSequence
      : [];
    const completedList = Array.isArray(teamData.completedCheckpointIds)
      ? teamData.completedCheckpointIds
      : [];
    const skippedList = Array.isArray(teamData.skippedCheckpointIds)
      ? teamData.skippedCheckpointIds
      : [];

    if (completedList.includes(checkpointId)) {
      throw new AppError(
        ErrorCode.CHECKPOINT_ALREADY_COMPLETED,
        'Pos kawalan ini telah pun diselesaikan oleh kumpulan anda.'
      );
    }

    if (skippedList.includes(checkpointId)) {
      throw new AppError(
        ErrorCode.ALREADY_SKIPPED,
        'Pos kawalan ini telah pun dilangkau sebelum ini.'
      );
    }

    if (
      teamData.currentCheckpointId &&
      teamData.currentCheckpointId !== checkpointId
    ) {
      throw new AppError(
        ErrorCode.OUT_OF_SEQUENCE,
        `Hanya pos semasa (${teamData.currentCheckpointId}) boleh dilangkau.`
      );
    }

    const maxSkips = eventData.rules?.maxSkipsPerTeam ?? 2;
    if (skippedList.length >= maxSkips) {
      throw new AppError(
        ErrorCode.SKIP_LIMIT_EXCEEDED,
        `Had maksimum melangkau (${maxSkips}) telah dicapai oleh kumpulan anda.`
      );
    }

    const updatedSkippedList = [...skippedList, checkpointId];

    let nextCheckpointId = checkpointId;
    const currentIndex = assignedSequence.indexOf(checkpointId);
    if (currentIndex !== -1) {
      for (let i = currentIndex + 1; i < assignedSequence.length; i++) {
        const candidateId = assignedSequence[i]!;
        if (
          !completedList.includes(candidateId) &&
          !updatedSkippedList.includes(candidateId)
        ) {
          nextCheckpointId = candidateId;
          break;
        }
      }
    }

    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const nowIso = new Date().toISOString();

    tx.update(teamRef, {
      skippedCheckpointIds: updatedSkippedList,
      currentCheckpointId: nextCheckpointId,
      updatedAt: serverTimestamp,
      updatedBy: caller.uid,
    });

    const scanLogRef = eventRef.collection(SCAN_LOGS_SUBCOLLECTION).doc();
    tx.set(scanLogRef, {
      id: scanLogRef.id,
      eventId,
      checkpointId,
      teamId,
      status: 'skipped',
      rejectionReason: options?.reason || 'Participant requested checkpoint skip',
      scannedAt: nowIso,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    return {
      teamId,
      skippedCheckpointId: checkpointId,
      nextCheckpointId,
      skippedCheckpointIds: updatedSkippedList,
      remainingSkips: Math.max(0, maxSkips - updatedSkippedList.length),
    };
  };

  if (options?.transaction) {
    return runLogic(options.transaction);
  }
  return db.runTransaction(runLogic);
}

/**
 * FR-02: Checkpoint Skip Logic
 */
export async function skipCheckpointService(
  eventId: string,
  checkpointId: string,
  caller: AuthenticatedUser,
  input?: SkipCheckpointInput
): Promise<SkipCheckpointResult> {
  const teamId = caller.teamId;
  if (!teamId) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Akses ditolak: Pengguna mestilah ahli kumpulan yang sah.'
    );
  }
  return processSkipCore(eventId, teamId, caller, checkpointId, { reason: input?.reason });
}

export async function processFinishCore(
  eventId: string,
  teamId: string,
  caller: AuthenticatedUser,
  input: FinishRaceScanInput,
  options?: { transaction?: admin.firestore.Transaction }
): Promise<FinishRaceResult> {
  if (!['participant', 'crew', 'admin'].includes(caller.role as string)) {
    throw new AppError(ErrorCode.FORBIDDEN, 'Akses ditolak: Peranan tidak dibenarkan.');
  }

  const payloadParts = input.payload.split(':');
  if (payloadParts.length !== 5) {
    throw new AppError(
      ErrorCode.INVALID_PAYLOAD,
      'Format payload kod QR penamat tidak sah.'
    );
  }

  const [qrTeamId, qrCheckpointId, qrTimestampStr, qrKeyIdStr, qrSignature] =
    payloadParts as [string, string, string, string, string];

  const secrets = await getEventSecrets(eventId);
  if (!secrets || !secrets.hmacSecret) {
    throw new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Kunci rahsia acara tidak ditemui.'
    );
  }

  const keyId = parseInt(qrKeyIdStr, 10);
  let secretToUse = secrets.hmacSecret;

  if (keyId === secrets.hmacKeyId) {
    secretToUse = secrets.hmacSecret;
  } else if (
    secrets.previousHmacKeyId &&
    keyId === secrets.previousHmacKeyId &&
    secrets.previousHmacSecret
  ) {
    secretToUse = secrets.previousHmacSecret;
  } else {
    throw new AppError(
      ErrorCode.INVALID_SIGNATURE,
      'Kunci HMAC tidak sah atau versi kunci telah tamat tempoh.'
    );
  }

  const rawDataToVerify = `${qrTeamId}:${qrCheckpointId}:${qrTimestampStr}:${qrKeyIdStr}`;
  const isSignatureValid = verifyHmacSignature(
    rawDataToVerify,
    qrSignature,
    secretToUse
  );

  if (!isSignatureValid) {
    throw new AppError(
      ErrorCode.INVALID_SIGNATURE,
      'Tandatangan kriptografi kod QR penamat tidak sah (Tampered).'
    );
  }

  const db = getFirestore();
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const teamRef = eventRef.collection(TEAMS_SUBCOLLECTION).doc(teamId);
  const checkpointRef = eventRef
    .collection(CHECKPOINTS_SUBCOLLECTION)
    .doc(qrCheckpointId);
  const qrTokenRef = eventRef
    .collection(QR_TOKENS_SUBCOLLECTION)
    .doc(qrSignature);
  const checkpointsCollectionRef = eventRef.collection(
    CHECKPOINTS_SUBCOLLECTION
  );

  const runLogic = async (tx: admin.firestore.Transaction) => {
    const [eventSnap, teamSnap, cpSnap, qrTokenSnap, allCpsSnap] =
      await Promise.all([
        tx.get(eventRef),
        tx.get(teamRef),
        tx.get(checkpointRef),
        tx.get(qrTokenRef),
        tx.get(checkpointsCollectionRef),
      ]);

    if (!eventSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
    }
    const eventData = eventSnap.data() as EventDocument;

    if (!eventData.isStarted) {
      throw new AppError(
        ErrorCode.RACE_NOT_STARTED,
        'Perlumbaan untuk acara ini belum bermula.'
      );
    }
    if (eventData.isFinished) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Acara ini telah tamat.');
    }

    if (!teamSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Kumpulan tidak ditemui.');
    }
    const teamData = teamSnap.data() as TeamDocument;

    if (teamData.isDisqualified) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Kumpulan anda telah dibatalkan penyertaan (Disqualified).'
      );
    }
    if (teamData.isExcluded) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Kumpulan anda telah dikecualikan daripada perlumbaan.'
      );
    }
    if (teamData.finishedAt) {
      throw new AppError(
        ErrorCode.RACE_ALREADY_FINISHED,
        'Kumpulan anda telah pun menamatkan perlumbaan.'
      );
    }

    if (!cpSnap.exists) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Pos kawalan penamat tidak ditemui.'
      );
    }
    const cpData = cpSnap.data() as CheckpointDocument;
    if (!cpData.isFinish) {
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        `Pos kawalan ${qrCheckpointId} bukan pos penamat.`
      );
    }

    const assignedSequence = Array.isArray(teamData.assignedSequence)
      ? teamData.assignedSequence
      : [];
    const completedList = Array.isArray(teamData.completedCheckpointIds)
      ? teamData.completedCheckpointIds
      : [];
    const skippedList = Array.isArray(teamData.skippedCheckpointIds)
      ? teamData.skippedCheckpointIds
      : [];

    const cpMap = new Map<string, string>();
    allCpsSnap.forEach((doc) => {
      const data = doc.data() as CheckpointDocument;
      cpMap.set(doc.id, data.name || doc.id);
    });

    const uncompletedCheckpoints: Array<{
      id: string;
      name: string;
      status: 'pending' | 'locked';
    }> = [];

    const courseCheckpoints = assignedSequence.filter(
      (id) => id !== qrCheckpointId
    );

    for (const cpId of courseCheckpoints) {
      if (!completedList.includes(cpId)) {
        const isSkipped = skippedList.includes(cpId);
        uncompletedCheckpoints.push({
          id: cpId,
          name: cpMap.get(cpId) || cpId,
          status: isSkipped ? 'pending' : 'locked',
        });
      }
    }

    if (uncompletedCheckpoints.length > 0) {
      throw new AppError(
        ErrorCode.INCOMPLETE_CHECKPOINTS,
        `Terdapat ${uncompletedCheckpoints.length} pos kawalan yang belum diselesaikan sepenuhnya.`,
        true,
        { uncompletedCheckpoints }
      );
    }

    if (!qrTokenSnap.exists) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Rekod token kod QR penamat tidak ditemui atau telah dipadam.'
      );
    }
    const tokenData = qrTokenSnap.data() as QrTokenDocument;
    const nowMs = Date.now();

    if (tokenData.expiresAt !== null && tokenData.expiresAt < nowMs) {
      throw new AppError(
        ErrorCode.TOKEN_EXPIRED,
        'Kod QR penamat telah tamat tempoh.'
      );
    }

    const redeemedList = Array.isArray(tokenData.redeemedByTeamIds)
      ? tokenData.redeemedByTeamIds
      : [];

    if (tokenData.teamId === '*') {
      if (redeemedList.includes(teamId)) {
        throw new AppError(
          ErrorCode.REPLAY_ATTACK,
          'Kod QR penamat telah pun diimbas oleh kumpulan anda.'
        );
      }
    } else {
      if (tokenData.scanned === true || redeemedList.includes(teamId)) {
        throw new AppError(
          ErrorCode.REPLAY_ATTACK,
          'Kod QR penamat telah pun digunakan.'
        );
      }
    }

    if (tokenData.teamId !== '*' && tokenData.teamId !== teamId) {
      throw new AppError(
        ErrorCode.WRONG_TEAM,
        `Kod QR penamat ini dijana khusus untuk kumpulan ${tokenData.teamId}.`
      );
    }

    if (
      eventData.geofenceBoundary &&
      eventData.geofenceBoundary.length >= 3
    ) {
      const isInsideEventBoundary = isPointInsidePolygon(
        { latitude: input.latitude, longitude: input.longitude },
        eventData.geofenceBoundary
      );
      if (!isInsideEventBoundary) {
        throw new AppError(
          ErrorCode.OUT_OF_EVENT_BOUNDARY,
          'Lokasi GPS anda berada di luar kawasan sempadan acara.'
        );
      }
    }

    const distanceMeters = haversineDistanceMeters(
      input.latitude,
      input.longitude,
      cpData.latitude,
      cpData.longitude
    );
    const allowedRadiusMeters = cpData.geofenceRadiusMeters || 50;

    if (distanceMeters > allowedRadiusMeters) {
      throw new AppError(
        ErrorCode.OUT_OF_CHECKPOINT_RADIUS,
        `Lokasi GPS anda (${Math.round(distanceMeters)}m) di luar radius penamat (${allowedRadiusMeters}m).`
      );
    }

    if (
      teamData.lastScanLat !== undefined &&
      teamData.lastScanLng !== undefined &&
      teamData.lastScanAt !== undefined
    ) {
      const distFromLastMeters = haversineDistanceMeters(
        teamData.lastScanLat,
        teamData.lastScanLng,
        input.latitude,
        input.longitude
      );
      const timeDeltaSeconds = Math.max(1, (nowMs - teamData.lastScanAt) / 1000);
      const velocityKmh = calculateVelocityKmh(distFromLastMeters, timeDeltaSeconds);
      const maxVelocityKmh = eventData.rules?.maxVelocityKmh ?? 40;

      if (velocityKmh > maxVelocityKmh) {
        throw new AppError(
          ErrorCode.SUSPECTED_SPOOFING,
          `Kelajuan pergerakan tidak munasabah (${Math.round(velocityKmh)} km/j > had ${maxVelocityKmh} km/j).`
        );
      }
    }

    let raceStartMs = nowMs;
    if (teamData.startedAt) {
      raceStartMs = new Date(teamData.startedAt).getTime();
    } else if (eventData.startedAt) {
      raceStartMs = new Date(eventData.startedAt).getTime();
    }
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - raceStartMs) / 1000));

    const maxDurationSeconds = eventData.maxDurationSeconds || 7200;
    let latePenaltyPoints = 0;

    if (
      eventData.rules?.latePenaltyEnabled !== false &&
      elapsedSeconds > maxDurationSeconds
    ) {
      const lateSeconds = elapsedSeconds - maxDurationSeconds;
      const lateMinutes = Math.ceil(lateSeconds / 60);
      const penaltyPerMin =
        eventData.rules?.latePenaltyPerMinute ??
        eventData.rules?.latePenaltyMin ??
        5;
      latePenaltyPoints = lateMinutes * penaltyPerMin;
    }

    const finishPoints =
      eventData.rules?.pointsSystemEnabled !== false
        ? cpData.scorePoints || 0
        : 0;
    const finalTotalPoints = Math.max(
      0,
      (teamData.totalPoints || 0) + finishPoints - latePenaltyPoints
    );

    const updatedCompletedList = [...completedList, qrCheckpointId];
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
    const nowIso = new Date(nowMs).toISOString();

    tx.update(teamRef, {
      isFinished: true,
      finishedAt: nowIso,
      totalTimeSeconds: elapsedSeconds,
      totalPoints: finalTotalPoints,
      completedCheckpointIds: updatedCompletedList,
      currentCheckpointId: qrCheckpointId,
      lastScanLat: input.latitude,
      lastScanLng: input.longitude,
      lastScanAt: nowMs,
      updatedAt: serverTimestamp,
      updatedBy: caller.uid,
    });

    tx.update(qrTokenRef, {
      redeemedByTeamIds: [...redeemedList, teamId],
      scanned: tokenData.teamId !== '*' ? true : tokenData.scanned,
      scannedAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    const leaderboardRef = eventRef.collection('leaderboard').doc(teamId);
    tx.set(
      leaderboardRef,
      {
        teamId,
        teamName: teamData.name,
        points: finalTotalPoints,
        elapsedSeconds,
        checkpointsCompleted: updatedCompletedList.length,
        checkpointsSkipped: skippedList.length,
        status: 'finished',
        finishedAt: nowIso,
        updatedAt: serverTimestamp,
      },
      { merge: true }
    );

    const scanLogRef = eventRef.collection(SCAN_LOGS_SUBCOLLECTION).doc();
    tx.set(scanLogRef, {
      id: scanLogRef.id,
      eventId,
      checkpointId: qrCheckpointId,
      teamId,
      status: 'finished',
      scannedAt: nowIso,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy || null,
      pointsAwarded: finishPoints,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    });

    return {
      teamId,
      isFinished: true as const,
      finishedAt: nowIso,
      elapsedSeconds,
      totalPoints: finalTotalPoints,
      penaltyPointsApplied: latePenaltyPoints,
      completedCheckpointIds: updatedCompletedList,
    };
  };

  if (options?.transaction) {
    return runLogic(options.transaction);
  }
  return db.runTransaction(runLogic);
}

/**
 * FR-03: Finish Line Gatekeeper & Race Completion
 */
export async function finishRaceService(
  eventId: string,
  caller: AuthenticatedUser,
  input: FinishRaceScanInput
): Promise<FinishRaceResult> {
  const teamId = caller.teamId;
  if (!teamId) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Akses ditolak: Pengguna mestilah ahli kumpulan yang sah.'
    );
  }
  return processFinishCore(eventId, teamId, caller, input);
}


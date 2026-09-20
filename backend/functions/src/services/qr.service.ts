/**
 * services/qr.service.ts
 *
 * Server-side Dynamic HMAC-SHA256 QR Code Generation Service.
 * PRD Security Layer 2 & FYP FR-01.
 */

import type { AuthenticatedUser } from '../middleware/auth';
import type { QrTokenDocument } from '../models';
import { findCheckpointById } from '../repositories/checkpoint.repository';
import { findEventById, getEventSecrets } from '../repositories/event.repository';
import { createQrToken, findActiveQrToken } from '../repositories/qr.repository';
import { assertEventOwner } from './event.service';
import {
  buildAttendanceQrPayload,
  buildCheckpointQrPayload,
} from '../utils/crypto';
import { AppError, ErrorCode } from '../utils/errors';
import type {
  GenerateAttendanceQrInput,
  GenerateCheckpointQrInput,
} from '../validation';

export interface CheckpointQrResult {
  payload: string;
  checkpointId: string;
  teamId: string;
  ttlSeconds: number;
  remainingTtlSeconds: number;
  expiresAt: number;
  keyId: number;
}

export interface AttendanceQrResult {
  payload: string;
  eventId: string;
  teamId: string;
  keyId: number;
  timestamp: number;
}

/**
 * Generates a time-limited, cryptographically signed checkpoint verification QR.
 * Enforces crew checkpoint ownership via custom claim `checkpointId`.
 */
export async function generateCheckpointQrService(
  eventId: string,
  checkpointId: string,
  caller: AuthenticatedUser,
  input: GenerateCheckpointQrInput
): Promise<CheckpointQrResult> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
  }

  assertEventOwner(event, caller.uid, caller.role, caller.eventId);

  const checkpoint = await findCheckpointById(eventId, checkpointId);
  if (!checkpoint) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Pos kawalan tidak ditemui.');
  }

  // Enforce Checkpoint Ownership RBAC
  if (caller.role === 'crew') {
    if (!caller.checkpointId || caller.checkpointId !== checkpointId) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Akses ditolak: Kru hanya boleh menjana kod QR untuk pos kawalan yang ditugaskan.'
      );
    }
  }

  const teamId = input.teamId || '*';
  const now = Date.now();

  // Return active unexpired token if available and not forced
  if (!input.forceRefresh) {
    const existing = await findActiveQrToken(eventId, checkpointId, teamId, now);
    if (existing && existing.expiresAt && existing.expiresAt > now) {
      const remainingTtl = Math.max(1, Math.round((existing.expiresAt - now) / 1000));
      return {
        payload: existing.payload,
        checkpointId,
        teamId,
        ttlSeconds: existing.ttlSeconds || 30,
        remainingTtlSeconds: remainingTtl,
        expiresAt: existing.expiresAt,
        keyId: existing.keyId,
      };
    }
  }

  // Read per-event HMAC secret from deny-all secrets collection
  const secrets = await getEventSecrets(eventId);
  if (!secrets || !secrets.hmacSecret) {
    throw new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Konfigurasi kunci HMAC acara tidak ditemui.'
    );
  }

  const ttlSeconds = input.ttlSeconds || 30;
  const expiresAt = now + ttlSeconds * 1000;
  const keyId = secrets.hmacKeyId || 1;

  const { payload, signature } = buildCheckpointQrPayload(
    {
      teamId,
      checkpointId,
      timestamp: now,
      keyId,
    },
    secrets.hmacSecret
  );

  const tokenDoc: Omit<QrTokenDocument, 'createdAt' | 'updatedAt'> = {
    id: signature,
    eventId,
    checkpointId,
    teamId,
    type: 'checkpoint',
    timestamp: now,
    expiresAt,
    ttlSeconds,
    keyId,
    signature,
    payload,
    scanned: false,
    redeemedByTeamIds: [],
    createdBy: caller.uid,
  };

  await createQrToken(eventId, tokenDoc);

  return {
    payload,
    checkpointId,
    teamId,
    ttlSeconds,
    remainingTtlSeconds: ttlSeconds,
    expiresAt,
    keyId,
  };
}

/**
 * Generates an attendance QR code for start check-in.
 */
export async function generateAttendanceQrService(
  eventId: string,
  caller: AuthenticatedUser,
  input: GenerateAttendanceQrInput
): Promise<AttendanceQrResult> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
  }

  assertEventOwner(event, caller.uid, caller.role, caller.eventId);

  const secrets = await getEventSecrets(eventId);
  if (!secrets || !secrets.hmacSecret) {
    throw new AppError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Konfigurasi kunci HMAC acara tidak ditemui.'
    );
  }

  const teamId = input.teamId || '*';
  const now = Date.now();
  const keyId = secrets.hmacKeyId || 1;

  const { payload, signature } = buildAttendanceQrPayload(
    {
      teamId,
      eventId,
      timestamp: now,
      keyId,
    },
    secrets.hmacSecret
  );

  const tokenDoc: Omit<QrTokenDocument, 'createdAt' | 'updatedAt'> = {
    id: signature,
    eventId,
    checkpointId: 'attendance',
    teamId,
    type: 'attendance',
    timestamp: now,
    expiresAt: null,
    ttlSeconds: null,
    keyId,
    signature,
    payload,
    scanned: false,
    redeemedByTeamIds: [],
    createdBy: caller.uid,
  };

  await createQrToken(eventId, tokenDoc);

  return {
    payload,
    eventId,
    teamId,
    keyId,
    timestamp: now,
  };
}

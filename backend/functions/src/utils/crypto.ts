/**
 * utils/crypto.ts
 *
 * Cryptographic helper utilities for HMAC-SHA256 QR payload generation and signature verification.
 * PRD Security Layer 2 & FYP FR-01.
 */

import * as crypto from 'crypto';

/**
 * Computes an HMAC-SHA256 hexadecimal digest for the given data and secret.
 */
export function signHmacSha256(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Safely compares two HMAC signatures in constant time to prevent timing attacks.
 */
export function verifyHmacSignature(
  data: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = signHmacSha256(data, secret);
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

export interface CheckpointQrPayloadParams {
  teamId: string;
  checkpointId: string;
  timestamp: number;
  keyId: number;
}

/**
 * Builds the canonical checkpoint QR payload string and computes its HMAC signature:
 * Format: `${teamId}:${checkpointId}:${timestamp}:${keyId}:${signature}`
 */
export function buildCheckpointQrPayload(
  params: CheckpointQrPayloadParams,
  secret: string
): { payload: string; signature: string; rawData: string } {
  const { teamId, checkpointId, timestamp, keyId } = params;
  const rawData = `${teamId}:${checkpointId}:${timestamp}:${keyId}`;
  const signature = signHmacSha256(rawData, secret);
  const payload = `${rawData}:${signature}`;

  return { payload, signature, rawData };
}

export interface AttendanceQrPayloadParams {
  teamId: string;
  eventId: string;
  timestamp: number;
  keyId: number;
}

/**
 * Builds the canonical attendance QR payload string and computes its HMAC signature:
 * Format: `${teamId}:${eventId}:attendance:${timestamp}:${keyId}:${signature}`
 */
export function buildAttendanceQrPayload(
  params: AttendanceQrPayloadParams,
  secret: string
): { payload: string; signature: string; rawData: string } {
  const { teamId, eventId, timestamp, keyId } = params;
  const rawData = `${teamId}:${eventId}:attendance:${timestamp}:${keyId}`;
  const signature = signHmacSha256(rawData, secret);
  const payload = `${rawData}:${signature}`;

  return { payload, signature, rawData };
}

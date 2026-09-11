/**
 * repositories/qr.repository.ts
 *
 * Data-access layer for single-use / dynamic QR tokens in Firestore:
 * Path: `events/{eventId}/qr_tokens/{tokenId}`
 *
 * Contract:
 *   • Admin SDK access only (bypasses security rules).
 *   • Never accessible directly from client SDKs.
 */

import * as admin from 'firebase-admin';

import { getFirestore } from '../config/firebase';
import type { QrTokenDocument } from '../models';

const EVENTS_COLLECTION = 'events';
const QR_TOKENS_SUBCOLLECTION = 'qr_tokens';

function toIso(value: unknown): string {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

function toQrTokenDocument(snap: admin.firestore.DocumentSnapshot): QrTokenDocument {
  const data = snap.data() as Omit<QrTokenDocument, 'id'>;
  return {
    ...data,
    id: snap.id,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    scannedAt: data.scannedAt ? toIso(data.scannedAt) : null,
    redeemedByTeamIds: Array.isArray(data.redeemedByTeamIds)
      ? data.redeemedByTeamIds
      : [],
  };
}

/**
 * Persists a generated dynamic QR token.
 */
export async function createQrToken(
  eventId: string,
  token: Omit<QrTokenDocument, 'createdAt' | 'updatedAt'>
): Promise<QrTokenDocument> {
  const db = getFirestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const docRef = db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(QR_TOKENS_SUBCOLLECTION)
    .doc(token.id);

  await docRef.set({
    ...token,
    redeemedByTeamIds: token.redeemedByTeamIds || [],
    createdAt: now,
    updatedAt: now,
  });

  const snap = await docRef.get();
  return toQrTokenDocument(snap);
}

/**
 * Finds the latest unexpired active QR token for a checkpoint and team.
 */
export async function findActiveQrToken(
  eventId: string,
  checkpointId: string,
  teamId: string,
  nowMs: number
): Promise<QrTokenDocument | null> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(QR_TOKENS_SUBCOLLECTION)
    .where('checkpointId', '==', checkpointId)
    .where('teamId', '==', teamId)
    .where('expiresAt', '>', nowMs)
    .orderBy('expiresAt', 'desc')
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }

  return toQrTokenDocument(snap.docs[0]);
}

/**
 * Finds a QR token by its unique signature / ID.
 */
export async function findQrTokenById(
  eventId: string,
  tokenId: string
): Promise<QrTokenDocument | null> {
  const db = getFirestore();
  const snap = await db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(QR_TOKENS_SUBCOLLECTION)
    .doc(tokenId)
    .get();

  if (!snap.exists) {
    return null;
  }

  return toQrTokenDocument(snap);
}

/**
 * Records redemption of a QR token with atomic transaction.
 * Supports both team-specific and broadcast ('*') tokens.
 */
export async function redeemQrToken(
  eventId: string,
  tokenId: string,
  teamId: string,
  nowMs: number = Date.now()
): Promise<QrTokenDocument> {
  const db = getFirestore();
  const docRef = db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(QR_TOKENS_SUBCOLLECTION)
    .doc(tokenId);

  return db.runTransaction(async (txn) => {
    const snap = await txn.get(docRef);
    if (!snap.exists) {
      throw new Error('QR_NOT_FOUND');
    }

    const token = toQrTokenDocument(snap);

    // Expiry check (for tokens with a finite TTL)
    if (token.expiresAt !== null && token.expiresAt < nowMs) {
      throw new Error('TOKEN_EXPIRED');
    }

    // Team-specific token check
    if (token.teamId !== '*' && token.teamId !== teamId) {
      throw new Error('TEAM_MISMATCH');
    }

    // Double redemption check
    if (token.redeemedByTeamIds.includes(teamId)) {
      throw new Error('ALREADY_REDEEMED');
    }

    const updatedRedeemed = [...token.redeemedByTeamIds, teamId];
    const isTeamSpecific = token.teamId !== '*';

    txn.update(docRef, {
      redeemedByTeamIds: updatedRedeemed,
      scanned: isTeamSpecific ? true : token.scanned,
      scannedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      ...token,
      redeemedByTeamIds: updatedRedeemed,
      scanned: isTeamSpecific ? true : token.scanned,
      scannedAt: new Date(nowMs).toISOString(),
    };
  });
}


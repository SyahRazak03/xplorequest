/**
 * services/sync.service.ts
 *
 * Stage 13: Offline Sync Queue Batch Ingestion Engine (FR-06).
 *
 * Provides batch ingestion for offline queued scan/skip/finish/override/penalty items.
 * Processes items with high-performance per-team Promise.all concurrency while
 * maintaining strict chronological order (clientTimestamp ASC) within each team group.
 */

import * as admin from 'firebase-admin';

import { getFirestore } from '../config/firebase';
import type { AuthenticatedUser } from '../middleware/auth';
import type { SyncIdempotencyDocument, SyncItemResult } from '../models';
import { AppError, ErrorCode } from '../utils/errors';
import type {
  ApplyPenaltyInput,
  BatchSyncInput,
  FinishRaceScanInput,
  ManualOverrideInput,
  ScanCheckpointQrInput,
  SyncQueueItemInput,
} from '../validation';

import {
  processFinishCore,
  processScanCore,
  processSkipCore,
} from './scan.service';
import {
  processOverrideCore,
  processPenaltyCore,
} from './verification.service';

const EVENTS_COLLECTION = 'events';
const SYNC_IDEMPOTENCY_SUBCOLLECTION = 'sync_idempotency';

interface IndexedSyncItem {
  item: SyncQueueItemInput;
  originalIndex: number;
}

/**
 * Orchestrates offline batch sync ingestion.
 *
 * 1. Groups items by teamId.
 * 2. Processes team groups concurrently via Promise.all.
 * 3. Keeps strict clientTimestamp ASC chronological order within each team group.
 * 4. Deduplicates using sync_idempotency collection.
 * 5. Re-enforces per-item role gates in processXCore functions.
 */
export async function processBatchSync(
  eventId: string,
  caller: AuthenticatedUser,
  input: BatchSyncInput
): Promise<SyncItemResult[]> {
  const db = getFirestore();
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const idempotencyColRef = eventRef.collection(SYNC_IDEMPOTENCY_SUBCOLLECTION);

  // 1. Group items by teamId (defaulting to caller.teamId or 'GLOBAL')
  const teamGroupsMap = new Map<string, IndexedSyncItem[]>();

  input.items.forEach((item, index) => {
    const teamId = item.teamId || caller.teamId || 'GLOBAL';
    if (!teamGroupsMap.has(teamId)) {
      teamGroupsMap.set(teamId, []);
    }
    teamGroupsMap.get(teamId)!.push({ item, originalIndex: index });
  });

  const results: SyncItemResult[] = new Array(input.items.length);

  // 2. Process all team groups concurrently via Promise.all
  await Promise.all(
    Array.from(teamGroupsMap.entries()).map(async ([teamId, groupItems]) => {
      // Sort team items strictly by clientTimestamp ASC
      groupItems.sort(
        (a, b) =>
          new Date(a.item.clientTimestamp).getTime() -
          new Date(b.item.clientTimestamp).getTime()
      );

      // Process items within team group sequentially
      for (const { item, originalIndex } of groupItems) {
        const itemResult = await processSingleSyncItem(
          db,
          eventId,
          teamId,
          caller,
          item,
          idempotencyColRef
        );
        results[originalIndex] = itemResult;
      }
    })
  );

  return results;
}

/**
 * Processes a single sync item with idempotency deduplication and atomic Firestore transaction.
 */
async function processSingleSyncItem(
  db: admin.firestore.Firestore,
  eventId: string,
  targetTeamId: string,
  caller: AuthenticatedUser,
  item: SyncQueueItemInput,
  idempotencyColRef: admin.firestore.CollectionReference
): Promise<SyncItemResult> {
  const idempotencyDocRef = idempotencyColRef.doc(item.idempotencyKey);
  const nowIso = new Date().toISOString();

  // 1. Read-check idempotency key doc outside transaction for fast skip
  const existingDocSnap = await idempotencyDocRef.get();
  if (existingDocSnap.exists) {
    const existingData = existingDocSnap.data() as SyncIdempotencyDocument;
    return {
      idempotencyKey: item.idempotencyKey,
      operation: item.operation,
      status: 'already_processed',
      error: existingData.errorCode
        ? {
            code: existingData.errorCode,
            message: existingData.errorMessage || 'Telah diproses sebelum ini.',
          }
        : undefined,
      processedAt: existingData.createdAt || nowIso,
    };
  }

  // 2. Run transaction for state mutation and idempotency doc creation
  try {
    const resultData = await db.runTransaction(async (tx) => {
      // Re-check idempotency inside transaction for race conditions
      const txDocSnap = await tx.get(idempotencyDocRef);
      if (txDocSnap.exists) {
        const txData = txDocSnap.data() as SyncIdempotencyDocument;
        return { isDuplicate: true, txData };
      }

      let resData: Record<string, unknown> = {};

      // Execute core operation based on item type
      switch (item.operation) {
        case 'checkpoint_scan': {
          const scanRes = await processScanCore(
            eventId,
            targetTeamId,
            caller,
            (item.payload || {}) as ScanCheckpointQrInput,
            item.checkpointId,
            { transaction: tx }
          );
          resData = scanRes as unknown as Record<string, unknown>;
          break;
        }

        case 'checkpoint_skip': {
          if (!item.checkpointId) {
            throw new AppError(
              ErrorCode.BAD_REQUEST,
              'checkpointId diperlukan untuk melangkau pos kawalan.'
            );
          }
          const skipRes = await processSkipCore(
            eventId,
            targetTeamId,
            caller,
            item.checkpointId,
            {
              transaction: tx,
              reason: (item.payload?.reason as string) || undefined,
            }
          );
          resData = skipRes as unknown as Record<string, unknown>;
          break;
        }

        case 'finish_scan': {
          const finishRes = await processFinishCore(
            eventId,
            targetTeamId,
            caller,
            (item.payload || {}) as FinishRaceScanInput,
            { transaction: tx }
          );
          resData = finishRes as unknown as Record<string, unknown>;
          break;
        }

        case 'manual_override': {
          if (!item.checkpointId) {
            throw new AppError(
              ErrorCode.BAD_REQUEST,
              'checkpointId diperlukan untuk pelepasan manual.'
            );
          }
          const overrideRes = await processOverrideCore(
            eventId,
            item.checkpointId,
            targetTeamId,
            caller,
            (item.payload || {}) as ManualOverrideInput,
            { transaction: tx }
          );
          resData = overrideRes as unknown as Record<string, unknown>;
          break;
        }

        case 'apply_penalty': {
          const penaltyRes = await processPenaltyCore(
            eventId,
            targetTeamId,
            caller,
            (item.payload || {}) as ApplyPenaltyInput,
            { transaction: tx }
          );
          resData = penaltyRes as unknown as Record<string, unknown>;
          break;
        }

        case 'photo_proof': {
          resData = {
            photoProofSynced: true,
            checkpointId: item.checkpointId,
            teamId: targetTeamId,
          };
          break;
        }

        default:
          throw new AppError(
            ErrorCode.BAD_REQUEST,
            `Jenis operasi sync '${(item as SyncQueueItemInput).operation}' tidak disokong.`
          );
      }

      // Write idempotency document inside transaction
      const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
      const idempotencyData: SyncIdempotencyDocument = {
        idempotencyKey: item.idempotencyKey,
        eventId,
        teamId: targetTeamId,
        operation: item.operation,
        scannedByUid: caller.uid,
        clientTimestamp: item.clientTimestamp,
        status: 'accepted',
        resultData: resData,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      tx.set(idempotencyDocRef, {
        ...idempotencyData,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      });

      return { isDuplicate: false, resData };
    });

    if (resultData.isDuplicate) {
      return {
        idempotencyKey: item.idempotencyKey,
        operation: item.operation,
        status: 'already_processed',
        processedAt: resultData.txData?.createdAt || nowIso,
      };
    }

    return {
      idempotencyKey: item.idempotencyKey,
      operation: item.operation,
      status: 'accepted',
      processedAt: nowIso,
    };
  } catch (err: unknown) {
    const errorObj =
      err instanceof AppError
        ? { code: err.code, message: err.message }
        : {
            code: ErrorCode.BAD_REQUEST,
            message: err instanceof Error ? err.message : 'Gagal memproses item sync.',
          };

    // Save failed attempt to idempotency collection so retries can report rejection reason
    try {
      const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();
      await idempotencyDocRef.set(
        {
          idempotencyKey: item.idempotencyKey,
          eventId,
          teamId: targetTeamId,
          operation: item.operation,
          scannedByUid: caller.uid,
          clientTimestamp: item.clientTimestamp,
          status: 'rejected',
          errorCode: errorObj.code,
          errorMessage: errorObj.message,
          createdAt: serverTimestamp,
          updatedAt: serverTimestamp,
        },
        { merge: true }
      );
    } catch {
      // Ignore background write error if idempotency fail-save fails
    }

    return {
      idempotencyKey: item.idempotencyKey,
      operation: item.operation,
      status: 'rejected',
      error: errorObj,
      processedAt: nowIso,
    };
  }
}

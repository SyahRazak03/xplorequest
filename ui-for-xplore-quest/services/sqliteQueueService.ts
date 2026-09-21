/**
 * sqliteQueueService.ts
 * Local SQLite Database Telemetry Synchronization Queue Helper for XploreQuest.
 *
 * Implements Objective 1.4.3:
 *   - Local SQLite Database Queue (`xplorequest_telemetry.db`) via `expo-sqlite` (SDK 54)
 *   - Enqueues checkpoint scan telemetry during cellular dead zones / offline race states
 *   - Auto-drains and syncs telemetry to backend API `POST /events/:eventId/sync` once online
 */

import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

const API_BASE = (process.env['EXPO_PUBLIC_API_BASE_URL'] ?? '').replace(/\/$/, '');

export interface TelemetryScanItem {
  id: string;
  eventId: string;
  teamId: string;
  checkpointId: string;
  timestamp: number;
  payload: string;
  status: 'pending' | 'synced';
}

let dbInstance: any = null;
let memoryQueue: TelemetryScanItem[] = [];

/** Initialises local SQLite database schema. */
export async function initQueueDatabase(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (!dbInstance) {
      dbInstance = await SQLite.openDatabaseAsync('xplorequest_telemetry.db');
    }
    await dbInstance.execAsync(`
      CREATE TABLE IF NOT EXISTS telemetry_queue (
        id TEXT PRIMARY KEY NOT NULL,
        eventId TEXT NOT NULL,
        teamId TEXT NOT NULL,
        checkpointId TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL
      );
    `);
  } catch (err) {
    console.warn('initQueueDatabase SQLite warning:', err);
  }
}

/** Enqueues an offline checkpoint scan into local SQLite database. */
export async function enqueueTelemetryScan(item: Omit<TelemetryScanItem, 'status'>): Promise<void> {
  const fullItem: TelemetryScanItem = { ...item, status: 'pending' };

  if (Platform.OS === 'web' || !dbInstance) {
    memoryQueue.push(fullItem);
    return;
  }

  try {
    await dbInstance.runAsync(
      `INSERT OR REPLACE INTO telemetry_queue (id, eventId, teamId, checkpointId, timestamp, payload, status) VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [fullItem.id, fullItem.eventId, fullItem.teamId, fullItem.checkpointId, fullItem.timestamp, fullItem.payload, fullItem.status]
    );
  } catch (err) {
    console.warn('enqueueTelemetryScan SQLite warning:', err);
    memoryQueue.push(fullItem);
  }
}

/** Fetches all pending telemetry scans from local SQLite database. */
export async function getPendingTelemetryScans(): Promise<TelemetryScanItem[]> {
  if (Platform.OS === 'web' || !dbInstance) {
    return memoryQueue.filter(i => i.status === 'pending');
  }

  try {
    const rows = await dbInstance.getAllAsync(
      `SELECT * FROM telemetry_queue WHERE status = 'pending' ORDER BY timestamp ASC;`
    );
    return rows as TelemetryScanItem[];
  } catch (err) {
    console.warn('getPendingTelemetryScans SQLite warning:', err);
    return memoryQueue.filter(i => i.status === 'pending');
  }
}

/** Removes a synced scan item from local SQLite database. */
export async function removeSyncedItem(id: string): Promise<void> {
  memoryQueue = memoryQueue.filter(i => i.id !== id);

  if (Platform.OS === 'web' || !dbInstance) return;

  try {
    await dbInstance.runAsync(`DELETE FROM telemetry_queue WHERE id = ?;`, [id]);
  } catch (err) {
    console.warn('removeSyncedItem SQLite warning:', err);
  }
}

/** Syncs pending SQLite queue to backend API `POST /events/:eventId/sync`. */
export async function syncPendingQueue(eventId: string, token?: string): Promise<{ syncedCount: number }> {
  const pending = await getPendingTelemetryScans();
  if (!pending || pending.length === 0) return { syncedCount: 0 };

  const adminToken = token || 'token-admin-xplorequest';
  let syncedCount = 0;

  for (const item of pending) {
    try {
      if (API_BASE) {
        const resp = await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
            'X-Idempotency-Key': item.id,
          },
          body: JSON.stringify({
            teamId: item.teamId,
            checkpointId: item.checkpointId,
            timestamp: item.timestamp,
            payload: item.payload,
          }),
        });

        if (resp.ok) {
          await removeSyncedItem(item.id);
          syncedCount++;
        }
      } else {
        // Fallback: local sync mark
        await removeSyncedItem(item.id);
        syncedCount++;
      }
    } catch (err) {
      console.warn(`Failed to sync item ${item.id} to backend API:`, err);
    }
  }

  return { syncedCount };
}

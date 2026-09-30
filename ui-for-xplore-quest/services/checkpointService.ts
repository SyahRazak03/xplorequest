/**
 * services/checkpointService.ts
 *
 * Frontend service for Checkpoint and Geofence Boundary management.
 * Communicates with Stage 6 backend endpoints.
 */

import type { Checkpoint } from '../types';

const API_BASE = (process.env['EXPO_PUBLIC_API_BASE_URL'] ?? '').replace(/\/$/, '');

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface BoundaryResponse {
  eventId: string;
  boundary: LatLng[];
}

export interface CreateCheckpointPayload {
  name: string;
  latitude: number;
  longitude: number;
  clueText?: string;
  taskDescription?: string;
  scorePoints?: number;
  geofenceRadiusMeters?: number;
  isStart?: boolean;
  isFinish?: boolean;
  isAttendanceStation?: boolean;
  isHiddenInMap?: boolean;
  orderIndex?: number;
}

/**
 * Fetches checkpoints for an event.
 * Role-projected response: participants receive coordinates only for unlocked/active checkpoints.
 */
export async function getCheckpoints(
  eventId: string,
  idToken?: string
): Promise<Checkpoint[]> {
  let tokenToUse = idToken;
  if (!tokenToUse) {
    try {
      const { loadAuthToken } = require('./storageService');
      tokenToUse = (await loadAuthToken()) || undefined;
    } catch {
      tokenToUse = undefined;
    }
  }

  if (API_BASE) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (tokenToUse) {
        headers['Authorization'] = `Bearer ${tokenToUse}`;
      }

      const resp = await fetch(
        `${API_BASE}/events/${encodeURIComponent(eventId)}/checkpoints`,
        { headers }
      );

      const json = (await resp.json()) as {
        success: boolean;
        data?: Checkpoint[];
        error?: { code: string; message: string };
      };

      if (resp.ok && json.success && json.data) {
        return json.data;
      }
    } catch (err) {
      console.warn('API getCheckpoints warning:', err);
    }
  }

  try {
    const { getFirebaseFirestore } = require('./firebaseService');
    const { collection, getDocs } = require('firebase/firestore');
    const db = getFirebaseFirestore();
    const snap = await getDocs(collection(db, 'events', eventId, 'checkpoints'));
    const list: Checkpoint[] = [];
    snap.forEach((doc: any) => {
      const d = doc.data();
      list.push({
        id: doc.id,
        name: d.name || 'Checkpoint',
        latitude: d.latitude || 0,
        longitude: d.longitude || 0,
        clueText: d.clueText || '',
        taskDescription: d.taskDescription || '',
        scorePoints: d.scorePoints || 10,
        geofenceRadiusMeters: d.geofenceRadiusMeters || 50,
        isStart: Boolean(d.isStart),
        isFinish: Boolean(d.isFinish),
        isAttendanceStation: Boolean(d.isAttendanceStation),
        isHiddenInMap: Boolean(d.isHiddenInMap),
        orderIndex: d.orderIndex || 0,
      });
    });
    return list;
  } catch (err) {
    console.warn('Failed to load event checkpoints from Firestore:', err);
    return [];
  }
}

/**
 * Creates a new checkpoint (Admin only).
 */
export async function createCheckpoint(
  eventId: string,
  payload: CreateCheckpointPayload,
  idToken?: string
): Promise<{ checkpoint: Checkpoint; warning?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const resp = await fetch(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/checkpoints`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }
  );

  const json = (await resp.json()) as {
    success: boolean;
    data?: Checkpoint;
    meta?: { warning?: string };
    error?: { code: string; message: string };
  };

  if (!resp.ok || !json.success || !json.data) {
    const msg = json.error?.message ?? 'Failed to create checkpoint.';
    throw new Error(msg);
  }

  return {
    checkpoint: json.data,
    warning: json.meta?.warning,
  };
}

/**
 * Updates an existing checkpoint (Admin only).
 */
export async function updateCheckpoint(
  eventId: string,
  checkpointId: string,
  payload: Partial<CreateCheckpointPayload>,
  idToken?: string
): Promise<{ checkpoint: Checkpoint; warning?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const resp = await fetch(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/checkpoints/${encodeURIComponent(checkpointId)}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    }
  );

  const json = (await resp.json()) as {
    success: boolean;
    data?: Checkpoint;
    meta?: { warning?: string };
    error?: { code: string; message: string };
  };

  if (!resp.ok || !json.success || !json.data) {
    const msg = json.error?.message ?? 'Failed to update checkpoint.';
    throw new Error(msg);
  }

  return {
    checkpoint: json.data,
    warning: json.meta?.warning,
  };
}

/**
 * Deletes a checkpoint from Firestore backend (Admin only).
 */
export async function deleteCheckpoint(
  eventId: string,
  checkpointId: string,
  idToken?: string,
  force: boolean = true
): Promise<boolean> {
  const headers: Record<string, string> = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const resp = await fetch(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/checkpoints/${encodeURIComponent(checkpointId)}?force=${force}`,
    {
      method: 'DELETE',
      headers,
    }
  );

  const json = (await resp.json()) as {
    success: boolean;
    error?: { code: string; message: string };
  };

  if (!resp.ok || !json.success) {
    const msg = json.error?.message ?? 'Failed to delete checkpoint.';
    throw new Error(msg);
  }

  return true;
}

/**
 * Saves/updates event geofence boundary polygon (Admin only).
 */
export async function saveBoundary(
  eventId: string,
  boundary: LatLng[],
  idToken?: string
): Promise<BoundaryResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const resp = await fetch(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/boundary`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ boundary }),
    }
  );

  const json = (await resp.json()) as {
    success: boolean;
    data?: BoundaryResponse;
    error?: { code: string; message: string };
  };

  if (!resp.ok || !json.success || !json.data) {
    const msg = json.error?.message ?? 'Failed to save geofence boundary.';
    throw new Error(msg);
  }

  return json.data;
}

export interface SkipResult {
  teamId: string;
  skippedCheckpointId: string;
  nextCheckpointId: string;
  skippedCheckpointIds: string[];
  remainingSkips: number;
}

export interface ScanResult {
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

export interface FinishResult {
  teamId: string;
  isFinished: true;
  finishedAt: string;
  elapsedSeconds: number;
  totalPoints: number;
  penaltyPointsApplied: number;
  completedCheckpointIds: string[];
}

export interface IncompleteCheckpointInfo {
  id: string;
  name: string;
  status: 'pending' | 'locked';
}

/**
 * FR-02: Skips current checkpoint if congested and advances sequence.
 */
export async function skipCheckpoint(
  eventId: string,
  checkpointId: string,
  idToken: string,
  reason?: string
): Promise<SkipResult> {
  const resp = await fetch(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/checkpoints/${encodeURIComponent(checkpointId)}/skip`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ reason }),
    }
  );

  const json = (await resp.json()) as {
    success: boolean;
    data?: SkipResult;
    error?: { code: string; message: string };
  };

  if (!resp.ok || !json.success || !json.data) {
    const msg = json.error?.message ?? 'Failed to skip checkpoint.';
    throw new Error(msg);
  }

  return json.data;
}

/**
 * Submits a participant QR scan (verifies sequence / resolving skipped CPs).
 */
export async function scanCheckpoint(
  eventId: string,
  checkpointId: string,
  payload: string,
  latitude: number,
  longitude: number,
  idToken: string,
  accuracy?: number
): Promise<ScanResult> {
  const resp = await fetch(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/checkpoints/${encodeURIComponent(checkpointId)}/scan`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ payload, latitude, longitude, accuracy }),
    }
  );

  const json = (await resp.json()) as {
    success: boolean;
    data?: ScanResult;
    error?: { code: string; message: string };
  };

  if (!resp.ok || !json.success || !json.data) {
    const msg = json.error?.message ?? 'Failed to verify checkpoint scan.';
    throw new Error(msg);
  }

  return json.data;
}

/**
 * FR-03: Finish Line Gatekeeper & race completion.
 */
export async function finishRaceScan(
  eventId: string,
  payload: string,
  latitude: number,
  longitude: number,
  idToken: string,
  accuracy?: number
): Promise<FinishResult> {
  const resp = await fetch(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/finish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ payload, latitude, longitude, accuracy }),
    }
  );

  const json = (await resp.json()) as {
    success: boolean;
    data?: FinishResult;
    error?: {
      code: string;
      message: string;
      details?: { uncompletedCheckpoints?: IncompleteCheckpointInfo[] };
    };
  };

  if (!resp.ok || !json.success || !json.data) {
    const errorObj = new Error(json.error?.message ?? 'Failed to finish race.') as Error & {
      code?: string;
      uncompletedCheckpoints?: IncompleteCheckpointInfo[];
    };
    errorObj.code = json.error?.code;
    errorObj.uncompletedCheckpoints = json.error?.details?.uncompletedCheckpoints;
    throw errorObj;
  }

  return json.data;
}

export interface AttendanceQRResponse {
  payload: string;
  eventId: string;
  teamId: string;
  keyId: number;
  timestamp: number;
}

/**
 * Generates a team-specific HMAC-SHA256 signed attendance QR code for start check-in (Crew/Admin).
 */
export async function generateAttendanceQR(
  eventId: string,
  teamId: string,
  idToken: string
): Promise<AttendanceQRResponse> {
  const resp = await fetch(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/attendance/qr`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ teamId }),
    }
  );

  const json = (await resp.json()) as {
    success: boolean;
    data?: AttendanceQRResponse;
    error?: { code: string; message: string };
  };

  if (!resp.ok || !json.success || !json.data) {
    const msg = json.error?.message ?? 'Failed to generate attendance release QR code.';
    throw new Error(msg);
  }

  return json.data;
}


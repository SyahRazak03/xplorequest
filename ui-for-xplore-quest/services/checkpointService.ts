/**
 * services/checkpointService.ts
 *
 * Frontend service for Checkpoint and Geofence Boundary management.
 * Communicates with Stage 6 backend endpoints.
 */

import type { Checkpoint } from '../mockData';

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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const resp = await fetch(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/checkpoints`,
    {
      headers,
    }
  );

  const json = (await resp.json()) as {
    success: boolean;
    data?: Checkpoint[];
    error?: { code: string; message: string };
  };

  if (!resp.ok || !json.success || !json.data) {
    const msg = json.error?.message ?? 'Gagal memuat turun pos kawalan.';
    throw new Error(msg);
  }

  return json.data;
}

/**
 * Creates a new checkpoint (Admin only).
 */
export async function createCheckpoint(
  eventId: string,
  payload: CreateCheckpointPayload,
  idToken: string
): Promise<{ checkpoint: Checkpoint; warning?: string }> {
  const resp = await fetch(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/checkpoints`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
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
    const msg = json.error?.message ?? 'Gagal mencipta pos kawalan.';
    throw new Error(msg);
  }

  return {
    checkpoint: json.data,
    warning: json.meta?.warning,
  };
}

/**
 * Saves/updates event geofence boundary polygon (Admin only).
 */
export async function saveBoundary(
  eventId: string,
  boundary: LatLng[],
  idToken: string
): Promise<BoundaryResponse> {
  const resp = await fetch(
    `${API_BASE}/events/${encodeURIComponent(eventId)}/boundary`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ boundary }),
    }
  );

  const json = (await resp.json()) as {
    success: boolean;
    data?: BoundaryResponse;
    error?: { code: string; message: string };
  };

  if (!resp.ok || !json.success || !json.data) {
    const msg = json.error?.message ?? 'Gagal menyimpan sempadan geofence.';
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
    const msg = json.error?.message ?? 'Gagal melangkau pos kawalan.';
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
    const msg = json.error?.message ?? 'Gagal mengesahkan imbasan pos kawalan.';
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
    const errorObj = new Error(json.error?.message ?? 'Gagal menamatkan perlumbaan.') as Error & {
      code?: string;
      uncompletedCheckpoints?: IncompleteCheckpointInfo[];
    };
    errorObj.code = json.error?.code;
    errorObj.uncompletedCheckpoints = json.error?.details?.uncompletedCheckpoints;
    throw errorObj;
  }

  return json.data;
}


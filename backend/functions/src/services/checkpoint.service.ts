/**
 * services/checkpoint.service.ts
 *
 * Business-logic layer for Geofence Boundary and Checkpoint configuration.
 *
 * Responsibilities:
 *   • Validates boundary polygon geometry (simple, non-self-intersecting, >= 3 vertices)
 *   • Manages checkpoints with singular start/finish rules and ordering
 *   • Validates point-in-polygon containment with warnings
 *   • Role-scoped projection: participants only receive coordinates of unlocked checkpoints
 *   • Race-integrity guards (all mutations blocked when event.isStarted === true)
 */

import type { CheckpointDocument, UserRole } from '../models';
import {
  createCheckpoint,
  deleteCheckpoint,
  findCheckpointById,
  findCheckpointsByEvent,
  updateCheckpoint,
  bulkUpdateCheckpointOrder,
} from '../repositories/checkpoint.repository';
import {
  findEventById,
  updateEvent,
} from '../repositories/event.repository';
import { assertEventOwner } from './event.service';
import { findTeamById, findTeamsByEvent } from '../repositories/team.repository';
import { AppError, ErrorCode } from '../utils/errors';
import {
  GeoPoint,
  isValidSimplePolygon,
  isPointInsidePolygon,
} from '../utils/geometry';
import type {
  CreateCheckpointInput,
  UpdateCheckpointInput,
} from '../validation';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Masked checkpoint view for participants.
 * Future/locked checkpoints have coordinates and task clues redacted
 * to prevent advance discovery or map extraction.
 */
export type ParticipantCheckpointView =
  | CheckpointDocument
  | {
      id: string;
      name: string;
      orderIndex: number;
      isStart?: boolean;
      isFinish?: boolean;
      isAttendanceStation?: boolean;
      isLocked: true;
    };

// ── Save Boundary ─────────────────────────────────────────────────────────────

export async function saveBoundaryService(
  eventId: string,
  boundary: GeoPoint[],
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<{ eventId: string; boundary: GeoPoint[] }> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  if (event.isStarted) {
    throw new AppError(
      ErrorCode.RACE_ALREADY_STARTED,
      'Geofence boundary cannot be modified after race has started.'
    );
  }

  const geomCheck = isValidSimplePolygon(boundary);
  if (!geomCheck.valid) {
    throw new AppError(
      ErrorCode.UNPROCESSABLE_ENTITY,
      geomCheck.reason || 'Invalid boundary polygon geometry.'
    );
  }

  await updateEvent(
    eventId,
    { geofenceBoundary: boundary as Array<{ x: number; y: number }> },
    callerUid
  );

  return { eventId, boundary };
}

// ── Create Checkpoint ─────────────────────────────────────────────────────────

export async function createCheckpointService(
  eventId: string,
  input: CreateCheckpointInput,
  callerUid?: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<{ checkpoint: CheckpointDocument; warning?: string }> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
  }

  if (callerUid) {
    assertEventOwner(event, callerUid, callerRole, callerEventId);
  }

  if (event.isStarted) {
    throw new AppError(
      ErrorCode.RACE_ALREADY_STARTED,
      'Checkpoints cannot be added after race has started.'
    );
  }

  const existingCheckpoints = await findCheckpointsByEvent(eventId);

  // Enforce singular isFinish flag (all teams converge on one finish line)
  if (input.isFinish) {
    const existingFinish = existingCheckpoints.find((cp) => cp.isFinish);
    if (existingFinish) {
      await updateCheckpoint(eventId, existingFinish.id, { isFinish: false }, callerUid);
    }
  }

  // Enforce singular isAttendanceStation flag
  if (input.isAttendanceStation) {
    const existingAttendance = existingCheckpoints.find((cp) => cp.isAttendanceStation);
    if (existingAttendance) {
      await updateCheckpoint(eventId, existingAttendance.id, { isAttendanceStation: false }, callerUid);
    }
  }

  // Determine orderIndex
  let orderIndex = input.orderIndex;
  if (orderIndex === undefined) {
    const maxOrder = existingCheckpoints.reduce(
      (max, cp) => (cp.orderIndex > max ? cp.orderIndex : max),
      0
    );
    orderIndex = maxOrder + 1;
  }

  // Point-in-polygon boundary check
  let warning: string | undefined;
  if (event.geofenceBoundary && event.geofenceBoundary.length >= 3) {
    const isInside = isPointInsidePolygon(
      { latitude: input.latitude, longitude: input.longitude },
      event.geofenceBoundary
    );
    if (!isInside) {
      warning = 'Checkpoint coordinates lie outside event geofence boundary.';
    }
  }

  const checkpointData: Omit<CheckpointDocument, 'id' | 'createdAt' | 'updatedAt'> = {
    name: input.name,
    latitude: input.latitude,
    longitude: input.longitude,
    clueText: input.clueText,
    taskDescription: input.taskDescription,
    scorePoints: input.scorePoints ?? 100,
    geofenceRadiusMeters: input.geofenceRadiusMeters ?? 50,
    isStart: Boolean(input.isStart),
    isFinish: Boolean(input.isFinish),
    isAttendanceStation: Boolean(input.isAttendanceStation),
    isHiddenInMap: Boolean(input.isHiddenInMap),
    orderIndex,
    statusPerTeam: {},
    eventId,
  };

  const checkpoint = await createCheckpoint(eventId, checkpointData);

  return { checkpoint, warning };
}

// ── List Checkpoints ──────────────────────────────────────────────────────────

export async function listCheckpointsService(
  eventId: string,
  callerRole: string,
  callerUid?: string,
  callerTeamId?: string,
  callerEventId?: string
): Promise<CheckpointDocument[] | ParticipantCheckpointView[]> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
  }

  if (callerUid && (callerRole === 'admin' || callerRole === 'crew')) {
    assertEventOwner(event, callerUid, callerRole as UserRole, callerEventId);
  }

  const checkpoints = await findCheckpointsByEvent(eventId);

  // Admin and Crew receive the full list including all coordinates and clues
  if (callerRole === 'admin' || callerRole === 'crew') {
    return checkpoints;
  }

  // Participant role: filter to unlocked checkpoints only (Security Layer 4)
  let teamCompletedIds: string[] = [];
  let teamCurrentId: string | null = null;

  if (callerTeamId) {
    const team = await findTeamById(eventId, callerTeamId);
    if (team) {
      teamCompletedIds = team.completedCheckpointIds || [];
      teamCurrentId = team.currentCheckpointId || null;
    }
  }

  const startCP = checkpoints.find((cp) => cp.isStart);

  return checkpoints.map((cp) => {
    const isUnlocked =
      cp.isStart ||
      cp.id === teamCurrentId ||
      teamCompletedIds.includes(cp.id) ||
      (!teamCurrentId && startCP && cp.id === startCP.id);

    if (isUnlocked) {
      return cp;
    }

    // Mask future locked/hidden checkpoints
    return {
      id: cp.id,
      name: cp.name,
      orderIndex: cp.orderIndex,
      isStart: cp.isStart,
      isFinish: cp.isFinish,
      isAttendanceStation: cp.isAttendanceStation,
      isLocked: true as const,
    };
  });
}

// ── Get Single Checkpoint ─────────────────────────────────────────────────────

export async function getCheckpointService(
  eventId: string,
  checkpointId: string,
  callerRole: string,
  callerUid?: string,
  callerTeamId?: string,
  callerEventId?: string
): Promise<CheckpointDocument | ParticipantCheckpointView> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
  }

  if (callerUid && (callerRole === 'admin' || callerRole === 'crew')) {
    assertEventOwner(event, callerUid, callerRole as UserRole, callerEventId);
  }

  const checkpoint = await findCheckpointById(eventId, checkpointId);
  if (!checkpoint) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Checkpoint not found.');
  }

  if (callerRole === 'admin' || callerRole === 'crew') {
    return checkpoint;
  }

  // For participant, verify if this checkpoint is unlocked
  if (callerTeamId) {
    const team = await findTeamById(eventId, callerTeamId);
    if (team) {
      const isUnlocked =
        checkpoint.isStart ||
        checkpoint.id === team.currentCheckpointId ||
        (team.completedCheckpointIds || []).includes(checkpoint.id);

      if (isUnlocked) {
        return checkpoint;
      }
    }
  }

  return {
    id: checkpoint.id,
    name: checkpoint.name,
    orderIndex: checkpoint.orderIndex,
    isStart: checkpoint.isStart,
    isFinish: checkpoint.isFinish,
    isAttendanceStation: checkpoint.isAttendanceStation,
    isLocked: true as const,
  };
}

// ── Update Checkpoint ─────────────────────────────────────────────────────────

export async function updateCheckpointService(
  eventId: string,
  checkpointId: string,
  input: UpdateCheckpointInput,
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<{ checkpoint: CheckpointDocument; warning?: string }> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  if (event.isStarted) {
    throw new AppError(
      ErrorCode.RACE_ALREADY_STARTED,
      'Checkpoints cannot be modified after race has started.'
    );
  }

  const existing = await findCheckpointById(eventId, checkpointId);
  if (!existing) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Checkpoint not found.');
  }

  // Enforce singular isFinish flag (all teams converge on one finish line)
  if (input.isFinish && !existing.isFinish) {
    const checkpoints = await findCheckpointsByEvent(eventId);
    const otherFinish = checkpoints.find((cp) => cp.isFinish && cp.id !== checkpointId);
    if (otherFinish) {
      await updateCheckpoint(eventId, otherFinish.id, { isFinish: false }, callerUid);
    }
  }

  // Enforce singular isAttendanceStation flag
  if (input.isAttendanceStation && !existing.isAttendanceStation) {
    const checkpoints = await findCheckpointsByEvent(eventId);
    const otherAttendance = checkpoints.find((cp) => cp.isAttendanceStation && cp.id !== checkpointId);
    if (otherAttendance) {
      await updateCheckpoint(eventId, otherAttendance.id, { isAttendanceStation: false }, callerUid);
    }
  }

  // Point-in-polygon warning
  let warning: string | undefined;
  const newLat = input.latitude ?? existing.latitude;
  const newLng = input.longitude ?? existing.longitude;
  if (event.geofenceBoundary && event.geofenceBoundary.length >= 3) {
    const isInside = isPointInsidePolygon(
      { latitude: newLat, longitude: newLng },
      event.geofenceBoundary
    );
    if (!isInside) {
      warning = 'Checkpoint coordinates lie outside event geofence boundary.';
    }
  }

  const updated = await updateCheckpoint(eventId, checkpointId, input, callerUid);

  return { checkpoint: updated, warning };
}

// ── Reorder Checkpoints ───────────────────────────────────────────────────────

export async function reorderCheckpointsService(
  eventId: string,
  checkpointIds: string[],
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<CheckpointDocument[]> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  if (event.isStarted) {
    throw new AppError(
      ErrorCode.RACE_ALREADY_STARTED,
      'Checkpoint sequence cannot be modified after race has started.'
    );
  }

  const orderUpdates = checkpointIds.map((id, index) => ({
    id,
    orderIndex: index + 1,
  }));

  await bulkUpdateCheckpointOrder(eventId, orderUpdates, callerUid);

  return findCheckpointsByEvent(eventId);
}

// ── Delete Checkpoint ─────────────────────────────────────────────────────────

export async function deleteCheckpointService(
  eventId: string,
  checkpointId: string,
  force = false,
  callerUid?: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<void> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
  }

  if (callerUid) {
    assertEventOwner(event, callerUid, callerRole, callerEventId);
  }

  if (event.isStarted) {
    throw new AppError(
      ErrorCode.RACE_ALREADY_STARTED,
      'Checkpoints cannot be deleted after race has started.'
    );
  }

  const checkpoint = await findCheckpointById(eventId, checkpointId);
  if (!checkpoint) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Checkpoint not found.');
  }

  if (!force) {
    const teams = await findTeamsByEvent(eventId);
    const hasProgress = teams.some(
      (t) =>
        t.currentCheckpointId === checkpointId ||
        (t.completedCheckpointIds && t.completedCheckpointIds.includes(checkpointId))
    );

    if (hasProgress) {
      throw new AppError(
        ErrorCode.CONFLICT,
        'Participant teams have existing records for this checkpoint. Please reset team positions before deleting.'
      );
    }
  }

  await deleteCheckpoint(eventId, checkpointId);
}

/**
 * services/team.service.ts
 *
 * Business-logic layer for team registration, management, and status updates.
 *
 * Responsibilities:
 *   • Validates event active status and maxTeamSize constraint on registration
 *   • Enforces duplicate team name checking within an event
 *   • Creates team documents with initial status: 'pending'
 *   • Role-scoped listing (admin/crew see all, participants see own team)
 *   • Admin approval/rejection and updates
 */

import type { TeamDocument, TeamStatus, UserRole } from '../models';
import {
  findEventById,
  findEventByJoinCode,
} from '../repositories/event.repository';
import { assertEventOwner } from './event.service';
import type { PublicTeamView } from '../repositories/team.repository';
import {
  createTeam,
  deleteTeam,
  findTeamById,
  findTeamByName,
  findTeamsByEvent,
  updateTeam,
  updateTeamStatus,
} from '../repositories/team.repository';
import { AppError, ErrorCode } from '../utils/errors';
import type { CreateTeamInput, UpdateTeamInput } from '../validation';

// ── Service Functions ─────────────────────────────────────────────────────────

/**
 * Registers a new team under an active event with status: 'pending'.
 * This is registration only — no authentication token is minted here.
 */
export async function registerTeamService(
  eventIdOrJoinCode: string,
  input: CreateTeamInput
): Promise<TeamDocument> {
  // 1. Resolve event (by eventId or by joinCode)
  let event = await findEventById(eventIdOrJoinCode);
  if (!event) {
    // Try lookup by joinCode if identifier is not an event doc ID
    const joinCodeToTry = input.joinCode || eventIdOrJoinCode;
    event = await findEventByJoinCode(joinCodeToTry);
  }

  if (!event) {
    // Generic error to prevent enumeration
    throw new AppError(
      ErrorCode.NOT_FOUND,
      'Event not found or invalid join code.'
    );
  }

  const eventId = event.id;

  // 2. Check if event is active
  if (event.isFinished) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Registration is closed because this event has ended.'
    );
  }

  // 3. Enforce per-event maxTeamSize
  const maxTeamSize = event.maxTeamSize || 6;
  if (input.memberCount > maxTeamSize) {
    throw new AppError(
      ErrorCode.UNPROCESSABLE_ENTITY,
      `Member count (${input.memberCount}) exceeds event maximum limit (${maxTeamSize} members).`
    );
  }

  // 4. Check for duplicate team name within this event (case-insensitive)
  const existingTeam = await findTeamByName(eventId, input.name);
  if (existingTeam) {
    throw new AppError(
      ErrorCode.CONFLICT,
      `Team name '${input.name}' is already registered for this event. Please choose another name.`
    );
  }

  // 5. Construct initial team document
  const teamData: Omit<TeamDocument, 'id' | 'createdAt' | 'updatedAt'> = {
    name: input.name,
    status: 'pending',
    memberCount: input.memberCount,
    leaderName: input.leaderName ?? '',
    membersList: input.membersList ?? '',
    phone: input.phone ?? '',
    eventId,
    startCheckpointId: 'CP-START',
    currentCheckpointId: 'CP-START',
    completedCheckpointIds: [],
    skippedCheckpointIds: [],
    totalPoints: 0,
    penaltiesMinutes: 0,
    penaltyPoints: 0,
    finishedAt: null,
    isDNF: false,
    isDisqualified: false,
    lastScanLocation: null,
  };

  return createTeam(eventId, teamData);
}

/**
 * Lists teams for an event scoped to caller's role.
 * Admin and Crew receive all teams.
 * Participants receive only their own team.
 */
export async function listTeamsService(
  eventId: string,
  callerRole: string,
  callerUid?: string,
  callerTeamId?: string,
  callerEventId?: string
): Promise<TeamDocument[] | PublicTeamView[]> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
  }

  if (callerUid && (callerRole === 'admin' || callerRole === 'crew')) {
    assertEventOwner(event, callerUid, callerRole as UserRole, callerEventId);
  }

  const allTeams = await findTeamsByEvent(eventId);

  if (callerRole === 'admin' || callerRole === 'crew') {
    return allTeams;
  }

  // Participant role: filter to own team only
  return allTeams.filter(
    (t) =>
      (callerTeamId && t.id === callerTeamId) ||
      (callerUid && t.leaderUid === callerUid)
  );
}

/**
 * Retrieves a single team by ID within an event.
 */
export async function getTeamService(
  eventId: string,
  teamId: string,
  callerRole: string,
  callerUid?: string,
  callerTeamId?: string,
  callerEventId?: string
): Promise<TeamDocument> {
  const event = await findEventById(eventId);
  if (event && callerUid && (callerRole === 'admin' || callerRole === 'crew')) {
    assertEventOwner(event, callerUid, callerRole as UserRole, callerEventId);
  }

  const team = await findTeamById(eventId, teamId);
  if (!team) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Team not found.');
  }

  if (
    callerRole === 'participant' &&
    team.id !== callerTeamId &&
    team.leaderUid !== callerUid
  ) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Access denied to view this team information.'
    );
  }

  return team;
}

/**
 * Updates team details (Admin only).
 */
export async function updateTeamService(
  eventId: string,
  teamId: string,
  input: UpdateTeamInput,
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<TeamDocument> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  const team = await findTeamById(eventId, teamId);
  if (!team) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Team not found.');
  }

  if (input.memberCount !== undefined) {
    const maxTeamSize = event.maxTeamSize || 6;
    if (input.memberCount > maxTeamSize) {
      throw new AppError(
        ErrorCode.UNPROCESSABLE_ENTITY,
        `Member count (${input.memberCount}) exceeds event maximum limit (${maxTeamSize} members).`
      );
    }
  }

  if (input.name && input.name.trim().toLowerCase() !== team.name.trim().toLowerCase()) {
    const existingName = await findTeamByName(eventId, input.name);
    if (existingName && existingName.id !== teamId) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Team name '${input.name}' is already in use for this event.`
      );
    }
  }

  return updateTeam(eventId, teamId, input, callerUid);
}

/**
 * Updates team status (Admin only).
 * When approved, the team becomes eligible for participant authentication.
 *
 * Race-integrity & active-session guards:
 *   1. If event.isStarted === true, status modifications are locked (RACE_ALREADY_STARTED).
 *   2. If team.leaderUid is set (participant has already authenticated/active session) and
 *      reverting to 'pending' is attempted, rejected with CONFLICT.
 */
export async function setTeamStatusService(
  eventId: string,
  teamId: string,
  status: TeamStatus,
  callerUid: string,
  callerRole?: UserRole,
  callerEventId?: string
): Promise<TeamDocument> {
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Event not found.');
  }

  assertEventOwner(event, callerUid, callerRole, callerEventId);

  const team = await findTeamById(eventId, teamId);
  if (!team) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Team not found.');
  }

  if (event.isStarted && team.status !== status) {
    throw new AppError(
      ErrorCode.RACE_ALREADY_STARTED,
      'Team status cannot be modified after race has started.'
    );
  }

  if (team.status === 'approved' && status === 'pending') {
    if (team.leaderUid) {
      throw new AppError(
        ErrorCode.CONFLICT,
        'This team already has an active session / logged in. Cannot revert back to pending status.'
      );
    }
  }

  return updateTeamStatus(eventId, teamId, status, callerUid);
}

/**
 * Deletes a team (Admin only).
 */
export async function deleteTeamService(
  eventId: string,
  teamId: string,
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

  const team = await findTeamById(eventId, teamId);
  if (!team) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Team not found.');
  }

  if (event.isStarted) {
    throw new AppError(
      ErrorCode.RACE_ALREADY_STARTED,
      'Teams cannot be deleted after race has started.'
    );
  }

  await deleteTeam(eventId, teamId);
}

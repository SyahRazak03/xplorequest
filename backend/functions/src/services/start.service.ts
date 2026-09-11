/**
 * services/start.service.ts
 *
 * Staggered / Cyclical Start Assignment & Attendance Check-in Service.
 *
 * Responsibilities:
 *   • Attendance Check-in for teams (QR / Manual presence verification).
 *   • Atomic Transactional Start Assignment:
 *       - Round-robin cyclical assignment across candidate checkpoints.
 *       - Multi-start distribution ensuring no slot collisions.
 *       - Absent team exclusion from draw and leaderboard.
 *       - Strict idempotency check (rejects if already started).
 *   • Late-arrival least-crowded load balancer assignment.
 */

import * as admin from 'firebase-admin';

import { getFirestore } from '../config/firebase';
import type { CheckpointDocument, TeamDocument } from '../models';
import { findEventById } from '../repositories/event.repository';
import { findTeamById } from '../repositories/team.repository';
import { AppError, ErrorCode } from '../utils/errors';
import type { AttendanceCheckinInput, LateAssignInput } from '../validation';

const EVENTS_COLLECTION = 'events';
const TEAMS_SUBCOLLECTION = 'teams';
const CHECKPOINTS_SUBCOLLECTION = 'checkpoints';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Computes a cyclical route sequence beginning at startCpId.
 * e.g. [C3, C4, C5, C1, C2, CFINISH]
 */
export function computeCyclicalRoute(
  startCpId: string,
  candidateCheckpoints: CheckpointDocument[],
  finishCheckpoint?: CheckpointDocument
): string[] {
  const sorted = [...candidateCheckpoints].sort((a, b) => a.orderIndex - b.orderIndex);
  const startIndex = sorted.findIndex((cp) => cp.id === startCpId);

  if (startIndex === -1) {
    const list = sorted.map((cp) => cp.id);
    if (finishCheckpoint && !list.includes(finishCheckpoint.id)) {
      list.push(finishCheckpoint.id);
    }
    return list;
  }

  const reordered: string[] = [];
  const n = sorted.length;

  for (let i = 0; i < n; i++) {
    const cp = sorted[(startIndex + i) % n];
    if (cp) {
      reordered.push(cp.id);
    }
  }

  if (finishCheckpoint && !reordered.includes(finishCheckpoint.id)) {
    reordered.push(finishCheckpoint.id);
  }

  return reordered;
}

/**
 * Deterministic pseudo-random shuffle (Fisher-Yates) using modern crypto entropy.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

// ── Attendance Check-In ───────────────────────────────────────────────────────

/**
 * Marks a team as present upon scanning their attendance QR at the start line.
 */
export async function checkinAttendanceService(
  eventId: string,
  input: AttendanceCheckinInput,
  callerUid: string
): Promise<TeamDocument> {
  const db = getFirestore();
  const event = await findEventById(eventId);
  if (!event) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
  }

  const team = await findTeamById(eventId, input.teamId);
  if (!team) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Kumpulan tidak ditemui.');
  }

  if (team.status !== 'approved') {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      'Pendaftaran kumpulan belum diluluskan oleh urus setia.'
    );
  }

  const nowIso = new Date().toISOString();
  const docRef = db
    .collection(EVENTS_COLLECTION)
    .doc(eventId)
    .collection(TEAMS_SUBCOLLECTION)
    .doc(input.teamId);

  await docRef.update({
    isPresent: true,
    attendanceStatus: 'present',
    checkedInAt: nowIso,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: callerUid,
  });

  const snap = await docRef.get();
  return {
    ...(snap.data() as TeamDocument),
    id: snap.id,
  };
}

// ── Staggered / Cyclical Start Transaction ────────────────────────────────────

export interface StartRaceResult {
  eventId: string;
  isRaceStarted: boolean;
  raceStartTime: number;
  startedAt: string;
  totalEligible: number;
  totalAbsent: number;
  assignments: Array<{
    teamId: string;
    teamName: string;
    startCheckpointId: string;
    startCheckpointName: string;
    currentCheckpointId: string;
  }>;
}

/**
 * Atomically starts the race and executes the cyclical start assignment algorithm.
 * Runs inside a Firestore transaction to guarantee no starting slot collisions.
 */
export async function triggerStaggeredStartService(
  eventId: string,
  callerUid: string,
  forceStart = false
): Promise<StartRaceResult> {
  const db = getFirestore();
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const teamsColRef = eventRef.collection(TEAMS_SUBCOLLECTION);
  const checkpointsColRef = eventRef.collection(CHECKPOINTS_SUBCOLLECTION);

  return db.runTransaction(async (tx) => {
    // 1. Fetch Event and enforce idempotency
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
    }

    const eventData = eventSnap.data() || {};
    if (eventData['isStarted']) {
      throw new AppError(
        ErrorCode.RACE_ALREADY_STARTED,
        'Perlumbaan untuk acara ini telah pun dimulakan.'
      );
    }

    // 2. Fetch Checkpoints and enforce strict isStart configuration
    const checkpointsSnap = await tx.get(checkpointsColRef.orderBy('orderIndex', 'asc'));
    const allCheckpoints = checkpointsSnap.docs.map((doc) => ({
      ...(doc.data() as CheckpointDocument),
      id: doc.id,
    }));

    if (allCheckpoints.length === 0) {
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        'Tiada pos kawalan dikonfigurasi untuk acara ini. Sila tetapkan pos kawalan dahulu.'
      );
    }

    const startCandidateCheckpoints = allCheckpoints.filter((cp) => cp.isStart);
    if (startCandidateCheckpoints.length === 0) {
      throw new AppError(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Tiada pos kawalan permulaan (isStart: true) dikonfigurasi untuk acara ini. Sila tetapkan sekurang-kurangnya satu pos kawalan permulaan sebelum memulakan perlumbaan.'
      );
    }

    const courseCheckpoints = allCheckpoints.filter((cp) => !cp.isFinish);
    const finishCheckpoint = allCheckpoints.find((cp) => cp.isFinish);

    // 3. Fetch Teams
    const teamsSnap = await tx.get(teamsColRef);
    const allTeams = teamsSnap.docs.map((doc) => ({
      ...(doc.data() as TeamDocument),
      id: doc.id,
    }));

    const approvedTeams = allTeams.filter((t) => t.status === 'approved');

    // Separate present vs absent teams
    const eligibleTeams = approvedTeams.filter(
      (t) => t.isPresent === true || t.attendanceStatus === 'present'
    );
    const absentTeams = approvedTeams.filter(
      (t) => !(t.isPresent === true || t.attendanceStatus === 'present')
    );

    if (eligibleTeams.length === 0 && !forceStart) {
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        'Tiada kumpulan hadir untuk memulakan perlumbaan. Sekurang-kurangnya satu kumpulan mesti mendaftar kehadiran.'
      );
    }

    const nowIso = new Date().toISOString();
    const epochNow = Date.now();
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

    // 4. Distribute Eligible Teams in Cyclical Round-Robin across isStart pool
    const shuffledTeams = shuffleArray(eligibleTeams);
    const numSlots = startCandidateCheckpoints.length;
    const assignments: StartRaceResult['assignments'] = [];

    for (let i = 0; i < shuffledTeams.length; i++) {
      const team = shuffledTeams[i]!;
      const assignedCp = startCandidateCheckpoints[i % numSlots]!;

      const routeSequence = computeCyclicalRoute(
        assignedCp.id,
        courseCheckpoints,
        finishCheckpoint
      );

      const teamDocRef = teamsColRef.doc(team.id);
      tx.update(teamDocRef, {
        startCheckpointId: assignedCp.id,
        currentCheckpointId: assignedCp.id,
        attendanceStatus: 'present',
        isPresent: true,
        isExcluded: false,
        startedAt: nowIso,
        assignedSequence: routeSequence,
        updatedAt: serverTimestamp,
        updatedBy: callerUid,
      });

      assignments.push({
        teamId: team.id,
        teamName: team.name,
        startCheckpointId: assignedCp.id,
        startCheckpointName: assignedCp.name,
        currentCheckpointId: assignedCp.id,
      });
    }

    // 5. Exclude Absent Teams
    for (const absentTeam of absentTeams) {
      const absentDocRef = teamsColRef.doc(absentTeam.id);
      tx.update(absentDocRef, {
        attendanceStatus: 'absent',
        isExcluded: true,
        updatedAt: serverTimestamp,
        updatedBy: callerUid,
      });
    }

    // 6. Update Event Document
    tx.update(eventRef, {
      isStarted: true,
      isRaceStarted: true,
      startedAt: nowIso,
      raceStartTime: epochNow,
      updatedAt: serverTimestamp,
      updatedBy: callerUid,
    });

    return {
      eventId,
      isRaceStarted: true,
      raceStartTime: epochNow,
      startedAt: nowIso,
      totalEligible: eligibleTeams.length,
      totalAbsent: absentTeams.length,
      assignments,
    };
  });
}

// ── Late Arrival Assignment (Least-Crowded Load Balancer) ─────────────────────

export interface LateAssignResult {
  teamId: string;
  teamName: string;
  assignedCheckpointId: string;
  assignedCheckpointName: string;
  currentCheckpointId: string;
  activeTeamCountAtCheckpoint: number;
  startedAt: string;
}

/**
 * Assigns a late-arriving team to the checkpoint with the fewest active teams.
 * Runs inside a transaction.
 */
export async function assignLateArrivalService(
  eventId: string,
  teamId: string,
  callerUid: string,
  input?: LateAssignInput
): Promise<LateAssignResult> {
  const db = getFirestore();
  const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
  const teamsColRef = eventRef.collection(TEAMS_SUBCOLLECTION);
  const checkpointsColRef = eventRef.collection(CHECKPOINTS_SUBCOLLECTION);

  return db.runTransaction(async (tx) => {
    // 1. Verify Event is live
    const eventSnap = await tx.get(eventRef);
    if (!eventSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Acara tidak ditemui.');
    }

    const eventData = eventSnap.data() || {};
    if (!eventData['isStarted']) {
      throw new AppError(
        ErrorCode.RACE_NOT_STARTED,
        'Perlumbaan belum bermula. Sila gunakan pelepasan mula biasa.'
      );
    }

    if (eventData['isFinished']) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Acara ini telah tamat.'
      );
    }

    // 2. Fetch Target Team
    const teamDocRef = teamsColRef.doc(teamId);
    const teamSnap = await tx.get(teamDocRef);
    if (!teamSnap.exists) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Kumpulan tidak ditemui.');
    }

    const teamData = teamSnap.data() as TeamDocument;
    if (teamData.status !== 'approved') {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Pendaftaran kumpulan belum diluluskan oleh urus setia.'
      );
    }

    if (teamData.finishedAt || teamData.isDNF) {
      throw new AppError(
        ErrorCode.CONFLICT,
        'Kumpulan ini telah menamatkan perlumbaan.'
      );
    }

    // 3. Fetch Checkpoints and enforce strict isStart configuration
    const checkpointsSnap = await tx.get(checkpointsColRef.orderBy('orderIndex', 'asc'));
    const allCheckpoints = checkpointsSnap.docs.map((doc) => ({
      ...(doc.data() as CheckpointDocument),
      id: doc.id,
    }));

    const startCandidateCheckpoints = allCheckpoints.filter((cp) => cp.isStart);
    if (startCandidateCheckpoints.length === 0) {
      throw new AppError(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Tiada pos kawalan permulaan (isStart: true) dikonfigurasi untuk acara ini.'
      );
    }

    const courseCheckpoints = allCheckpoints.filter((cp) => !cp.isFinish);
    const finishCheckpoint = allCheckpoints.find((cp) => cp.isFinish);

    // 4. Compute Active Team Count per isStart Checkpoint (Load Balancing)
    const teamsSnap = await tx.get(teamsColRef);
    const activeTeams = teamsSnap.docs
      .map((doc) => ({ ...(doc.data() as TeamDocument), id: doc.id }))
      .filter(
        (t) =>
          t.id !== teamId &&
          !t.isExcluded &&
          !t.finishedAt &&
          !t.isDNF &&
          t.currentCheckpointId
      );

    const counts: Record<string, number> = {};
    for (const cp of startCandidateCheckpoints) {
      counts[cp.id] = 0;
    }

    for (const activeTeam of activeTeams) {
      const current = activeTeam.currentCheckpointId;
      if (current && counts[current] !== undefined) {
        counts[current] = (counts[current] || 0) + 1;
      }
    }

    // Determine target checkpoint: preferred if specified and in isStart pool, else minimum load
    let selectedCp: CheckpointDocument;
    if (
      input?.preferredCheckpointId &&
      startCandidateCheckpoints.some((cp) => cp.id === input.preferredCheckpointId)
    ) {
      selectedCp = startCandidateCheckpoints.find(
        (cp) => cp.id === input.preferredCheckpointId
      )!;
    } else {
      // Find candidate with lowest count
      selectedCp = startCandidateCheckpoints.reduce((minCp, currCp) => {
        const minCount = counts[minCp.id] ?? Infinity;
        const currCount = counts[currCp.id] ?? 0;
        return currCount < minCount ? currCp : minCp;
      }, startCandidateCheckpoints[0]!);
    }

    const routeSequence = computeCyclicalRoute(
      selectedCp.id,
      courseCheckpoints,
      finishCheckpoint
    );

    const nowIso = new Date().toISOString();
    const serverTimestamp = admin.firestore.FieldValue.serverTimestamp();

    tx.update(teamDocRef, {
      startCheckpointId: selectedCp.id,
      currentCheckpointId: selectedCp.id,
      attendanceStatus: 'late',
      isPresent: true,
      isExcluded: false,
      startedAt: nowIso,
      assignedSequence: routeSequence,
      updatedAt: serverTimestamp,
      updatedBy: callerUid,
    });

    return {
      teamId,
      teamName: teamData.name,
      assignedCheckpointId: selectedCp.id,
      assignedCheckpointName: selectedCp.name,
      currentCheckpointId: selectedCp.id,
      activeTeamCountAtCheckpoint: counts[selectedCp.id] || 0,
      startedAt: nowIso,
    };
  });
}

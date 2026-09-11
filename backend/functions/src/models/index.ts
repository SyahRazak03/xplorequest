/**
 * models/index.ts
 *
 * Domain type definitions for XploreQuest.
 *
 * These mirror the TypeScript interfaces in the frontend's mockData.ts
 * so that the backend can share the same data shape. Backend-specific
 * fields (Firestore timestamps, audit fields) are added below the
 * frontend-compatible interface block.
 */

// ── Core Enums / Union Types ─────────────────────────────────────────────────

export type UserRole = 'participant' | 'crew' | 'admin';
export type CheckpointStatus = 'locked' | 'active' | 'pending' | 'completed';
export type TeamStatus = 'pending' | 'approved' | 'rejected';
export type AttendanceStatus = 'absent' | 'present' | 'late';
export type ScanResult =
  | 'accepted'
  | 'rejected_hmac'
  | 'rejected_expired'
  | 'rejected_geofence'
  | 'rejected_velocity'
  | 'rejected_device';

// ── Firestore Audit Fields ────────────────────────────────────────────────────

export interface AuditFields {
  /** ISO-8601 string or Firestore Timestamp */
  createdAt: string;
  updatedAt: string;
  /** UID of the user who last modified the document */
  updatedBy?: string;
}

// ── Domain Models ────────────────────────────────────────────────────────────

export interface EventConfig {
  id: string;
  name: string;
  /** 6-character alphanumeric join code shared with participants */
  joinCode?: string;
  date: string;
  /** Maximum race duration in seconds */
  maxDurationSeconds: number;
  locationName: string;
  totalCheckpoints: number;
}

/** EventConfig as stored in Firestore root document `events/{eventId}` */
export type EventDocument = EventConfig &
  AuditFields & {
    /** Start time string e.g. "08:00 AM" */
    startTime: string;
    /** Maximum members allowed per team */
    maxTeamSize: number;
    /** Whether the race has been started by admin */
    isStarted: boolean;
    /** Timestamp when race was started, null if not yet started */
    startedAt: string | null;
    /** Whether event is completed */
    isFinished: boolean;
    /** Geofence polygon vertices drawn in AdminGeofenceDesigner */
    geofenceBoundary?: Array<{ x?: number; y?: number; latitude?: number; longitude?: number }>;
    /** Optional race configuration rules */
    rules?: RaceRules;
    /** Admin UID who created the event */
    createdBy: string;
  };

/** Sensitive Event Credentials stored in `events/{eventId}/secrets/config` (Admin only read) */
export interface EventSecretsDocument extends AuditFields {
  /** 4-digit pin code for crew checkpoint access gate */
  crewPinCode: string;
  /** Secret key for HMAC QR generation */
  hmacSecret: string;
  /** Key ID / version number for rotation support (default: 1) */
  hmacKeyId: number;
  /** Immediately preceding HMAC secret (grace window during rotation) */
  previousHmacSecret?: string;
  /** Immediately preceding HMAC key ID */
  previousHmacKeyId?: number;
}

export type QrTokenType = 'checkpoint' | 'attendance';

/** Dynamic HMAC QR token document stored in `events/{eventId}/qr_tokens/{tokenId}` */
export interface QrTokenDocument extends AuditFields {
  /** Unique token ID (HMAC signature) */
  id: string;
  /** Event this token was generated for */
  eventId: string;
  /** Checkpoint ID or 'attendance' */
  checkpointId: string;
  /** Target team ID or '*' for broadcast stations (e.g. CP-TAMAT) */
  teamId: string;
  /** QR Token Type */
  type: QrTokenType;
  /** Epoch milliseconds when generated */
  timestamp: number;
  /** Epoch milliseconds when token expires, or null for attendance tokens */
  expiresAt: number | null;
  /** TTL in seconds (e.g. 30), or null for attendance */
  ttlSeconds: number | null;
  /** Secret key version used to sign this token */
  keyId: number;
  /** HMAC-SHA256 hex signature */
  signature: string;
  /** Full decoded string payload encoded in QR code */
  payload: string;
  /** Single-use scanned flag (true once redeemed by target team or any team in team-specific mode) */
  scanned: boolean;
  /** ISO timestamp when scanned */
  scannedAt?: string | null;
  /** Team IDs that have redeemed this token (supports broadcast QRs without race collisions) */
  redeemedByTeamIds: string[];
  /** UID of crew / admin who generated this QR */
  createdBy: string;
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  /** Timestamp (ISO string or ms) when scan location was captured */
  timestamp: string;
  checkpointId?: string;
}

export interface Team {
  id: string;
  name: string;
  status: TeamStatus;
  memberCount: number;
  startCheckpointId: string;
  currentCheckpointId: string;
  completedCheckpointIds: string[];
  skippedCheckpointIds: string[];
  leaderName?: string;
  membersList?: string;
  phone?: string;
}

/** Team as stored in Firestore `events/{eventId}/teams/{teamId}` */
export type TeamDocument = Team &
  AuditFields & {
    /** Firebase Auth UID of the team leader */
    leaderUid?: string;
    /** Event this team belongs to */
    eventId: string;
    /** Total points accumulated */
    totalPoints: number;
    /** Accumulated time penalties in minutes */
    penaltiesMinutes: number;
    /** Accumulated point deductions */
    penaltyPoints: number;
    /** ISO Timestamp when team crossed CP-TAMAT */
    finishedAt?: string | null;
    /** Attendance status: absent, present, or late */
    attendanceStatus?: AttendanceStatus;
    /** Whether team is physically present at start check-in */
    isPresent?: boolean;
    /** Timestamp when team checked in attendance */
    checkedInAt?: string | null;
    /** Whether team is excluded from draw and leaderboard due to absence */
    isExcluded?: boolean;
    /** Timestamp when team was released / started */
    startedAt?: string | null;
    /** Cyclical checkpoint route assigned to this team */
    assignedSequence?: string[];
    /** Total race duration in seconds */
    totalTimeSeconds?: number;
    /** Whether team has successfully completed the race */
    isFinished?: boolean;
    /** Did Not Finish flag */
    isDNF: boolean;
    /** Disqualified flag */
    isDisqualified: boolean;
    /**
     * Single overwritable last scan location for velocity checking.
     * Overwritten on each successful scan (not a growing trail log) per PDPA minimization.
     */
    lastScanLat?: number;
    lastScanLng?: number;
    lastScanAt?: number;
    lastScanLocation?: LocationPoint | null;
  };

export interface ScanLogDocument extends AuditFields {
  id: string;
  eventId: string;
  checkpointId: string;
  teamId: string;
  status: 'verified' | 'rejected_hmac' | 'rejected_expired' | 'rejected_geofence' | 'rejected_velocity' | 'rejected_device' | 'rejected_sequence' | 'rejected_team';
  scannedAt: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  rejectionReason?: string;
  velocityKmh?: number;
  pointsAwarded?: number;
}

export interface Checkpoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  clueText: string;
  taskDescription: string;
  scorePoints: number;
  /** Per-team status map. Key = teamId, Value = CheckpointStatus */
  statusPerTeam: Record<string, CheckpointStatus>;
  isStart?: boolean;
  isFinish?: boolean;
  isHiddenInMap?: boolean;
}

/** Checkpoint as stored in Firestore `events/{eventId}/checkpoints/{checkpointId}` */
export type CheckpointDocument = Checkpoint &
  AuditFields & {
    eventId: string;
    /** Order sequence for checkpoint list */
    orderIndex: number;
    /** Geofence radius slider value in meters (10 to 150m) */
    geofenceRadiusMeters: number;
    /** Firebase Auth UID of assigned crew/marshal */
    assignedCrewUid?: string;
    /** Marshal display name */
    assignedMarshalName?: string;
    /** Marshal phone number (PDPA-sensitive) */
    assignedMarshalPhone?: string;
    /** Storage URL of verification photo proof */
    photoProofUrl?: string;
  };

export interface Marshal {
  id: string;
  name: string;
  /** 1:1 binding to a Checkpoint */
  checkpointId: string;
  phone: string;
  avatarUrl?: string;
  activeQueueCount: number;
}

export interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  rank: number;
  totalPoints: number;
  totalTimeSeconds: number;
  /** Formatted total time, e.g. "1j 42m" (Malaysian Jam/Minit) */
  totalTimeFormatted: string;
  penaltiesMinutes: number;
  /** Did Not Finish — true if team ran out of time */
  isDNF: boolean;
  checkpointsCompleted: number;
  checkpointsSkipped: number;
  status: 'active' | 'finished' | 'dnf';
  finishedAt?: string | null;
}

/** Leaderboard document in `events/{eventId}/leaderboard/{teamId}` (omits dynamic rank & totalTimeFormatted) */
export type LeaderboardDocument = Omit<LeaderboardEntry, 'rank' | 'totalTimeFormatted'> &
  AuditFields & {
    eventId: string;
    startedAt?: string | null;
  };

export interface ScanLogDocument extends AuditFields {
  id: string;
  eventId: string;
  teamId: string;
  checkpointId: string;
  scannedByUid: string;
  scanType: 'qr_participant' | 'qr_crew' | 'manual_crew' | 'offline_sync';
  result: ScanResult;
  hmacValid: boolean;
  geofencePass: boolean;
  velocityPass: boolean;
  /** Hashed device fingerprint */
  deviceId: string;
  photoProofUrl?: string;
  penaltyApplied?: number;
  penaltyMinutesApplied?: number;
  isOfflineSync: boolean;
  syncedAt?: string;
}

export interface SyncQueueDocument extends AuditFields {
  id: string;
  deviceId: string;
  uid: string;
  eventId: string;
  operation: 'checkpoint_complete' | 'photo_upload' | 'penalty_apply';
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'done' | 'failed';
  processedAt?: string;
  retryCount: number;
}

// ── OFFLINE SYNC QUEUE TYPES (FR-06) ─────────────────────────────────────────

export type SyncOperation =
  | 'checkpoint_scan'
  | 'checkpoint_skip'
  | 'photo_proof'
  | 'manual_override'
  | 'apply_penalty'
  | 'finish_scan';

export interface SyncQueueItem {
  idempotencyKey: string;
  operation: SyncOperation;
  clientTimestamp: string;
  checkpointId?: string;
  teamId?: string;
  payload?: Record<string, unknown>;
}

export interface SyncItemResult {
  idempotencyKey: string;
  operation: string;
  status: 'accepted' | 'rejected' | 'already_processed';
  error?: {
    code: string;
    message: string;
  };
  processedAt: string;
}

export interface SyncIdempotencyDocument extends AuditFields {
  idempotencyKey: string;
  eventId: string;
  teamId: string;
  operation: string;
  scannedByUid: string;
  clientTimestamp: string;
  status: 'accepted' | 'rejected';
  resultData?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  avatarUrl?: string;
  teamId?: string;
  teamName?: string;
  checkpointId?: string;
  eventId?: string;
  eventName?: string;
  pushToken?: string;
  pushTokenUpdatedAt?: string;
}

/** UserProfile as stored in Firestore `/users/{uid}` */
export type UserDocument = UserProfile &
  AuditFields & {
    uid: string;
    /** Active event scope — set on crew and participant documents */
    eventId?: string;
    customClaims?: {
      role: UserRole;
      eventId?: string;
    };
    pushToken?: string;
    pushTokenUpdatedAt?: string;
  };

// ── SESSION RECOVERY TYPES (FR-10) ───────────────────────────────────────────

export interface TeamStateResponse {
  teamId: string;
  teamName: string;
  eventId: string;
  eventName: string;
  status: TeamStatus;
  currentCheckpointId: string;
  currentCheckpoint: {
    id: string;
    name: string;
    clueText: string;
    taskDescription: string;
    scorePoints: number;
    latitude: number;
    longitude: number;
    geofenceRadiusMeters: number;
    isStart?: boolean;
    isFinish?: boolean;
  } | null;
  completedCheckpointIds: string[];
  skippedCheckpointIds: string[];
  assignedSequence: string[];
  totalPoints: number;
  penaltiesMinutes: number;
  penaltyPoints: number;
  isStarted: boolean;
  isFinished: boolean;
  finishedAt: string | null;
  startedAt: string | null;
  maxDurationSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  isDNF: boolean;
  isDisqualified: boolean;
}


export interface RaceRules {
  maxRaceTime: number;
  taskTimeLimit: number;
  latePenaltyMin: number;
  pointPenaltyPts: number;
  bonusPoints: number;
  pointsSystemEnabled: boolean;
  latePenaltyEnabled: boolean;
  taskTimeLimitEnabled: boolean;
  pointPenaltyEnabled: boolean;
  bonusPointsEnabled: boolean;
  /** Maximum plausible velocity in km/h for GPS anti-spoofing checks (default: 40) */
  maxVelocityKmh?: number;
  /** Maximum number of checkpoint skips allowed per team (default: 2) */
  maxSkipsPerTeam?: number;
  /** Points deducted per minute past max race duration (default: 5) */
  latePenaltyPerMinute?: number;
}

/**
 * types.ts
 * Clean TypeScript Interfaces & Types for XploreQuest
 */

export type UserRole = 'participant' | 'crew' | 'admin';
export type CheckpointStatus = 'locked' | 'active' | 'pending' | 'completed';
export type TeamStatus = 'pending' | 'approved';

export interface PaymentDetails {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  note?: string;
}

export interface EventConfig {
  id: string;
  name: string;
  joinCode?: string;
  date: string;
  maxDurationSeconds: number;
  locationName: string;
  totalCheckpoints: number;
  urlSlug?: string;
  entryFee?: number;
  paymentBankDetails?: string;
  paymentDetails?: PaymentDetails | null;
  paymentQrImageUrl?: string | null;
  bannerImageUrl?: string | null;
  latitude?: number;
  longitude?: number;
  geofenceBoundary?: Array<{ latitude: number; longitude: number }>;
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
  isPresent?: boolean;
  attendanceStatus?: 'absent' | 'present' | 'late';
  isRaceStarted?: boolean;
  raceStartedAt?: number;
  points?: number;
  totalPoints?: number;
}

export interface Checkpoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  clueText: string;
  taskDescription: string;
  scorePoints: number;
  geofenceRadiusMeters?: number;
  imageUrl?: string;
  statusPerTeam: Record<string, CheckpointStatus>;
  isStart?: boolean;
  isFinish?: boolean;
  isAttendanceStation?: boolean;
  isHiddenInMap?: boolean;
}

export interface Marshal {
  id: string;
  name: string;
  checkpointId: string;
  phone: string;
  avatarUrl?: string;
  activeQueueCount: number;
}

export interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  rank: number;
  points: number;
  totalTimeFormatted: string;
  penaltiesMinutes: number;
  isDNF: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  avatarUrl?: string;
  teamId?: string;
  checkpointId?: string;
  eventId?: string;
  idToken?: string;
}

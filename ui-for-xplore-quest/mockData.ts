/**
 * mockData.ts
 * Self-contained Mock Data Layer for XploreQuest
 * Created for Dapo Awoknyee Resources (KL Event Crew) client demo.
 */

// ==========================================
// 1. TypeScript Interfaces
// ==========================================

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
}


export interface Checkpoint {
  id: string;
  name: string;
  latitude: number; // For geofencing demo mapping
  longitude: number;
  clueText: string;
  taskDescription: string;
  scorePoints: number;
  geofenceRadiusMeters?: number;
  // Dynamic status mapping per team ID: Record<teamId, CheckpointStatus>
  statusPerTeam: Record<string, CheckpointStatus>;
  isStart?: boolean;
  isFinish?: boolean;
  isAttendanceStation?: boolean;
  isHiddenInMap?: boolean;
}

export interface Marshal {
  id: string;
  name: string;
  checkpointId: string; // 1:1 binding to Checkpoint
  phone: string;
  avatarUrl?: string;
  activeQueueCount: number; // Simulated pending team arrivals
}

export interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  rank: number;
  points: number;
  totalTimeFormatted: string; // e.g. "1j 42m" (Malaysian Jam/Minit)
  penaltiesMinutes: number;
  isDNF: boolean; // Did Not Finish flag (e.g. out of time limit)
}

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  avatarUrl?: string;
  // Role-specific fields
  teamId?: string; // If participant
  checkpointId?: string; // If crew/marshal
  eventId?: string;
  idToken?: string;
}

// ==========================================
// 2. Empty Default Data Arrays (Production Ready)
// ==========================================

export const mockEvent: EventConfig = {
  id: '',
  name: '',
  date: '',
  maxDurationSeconds: 14400,
  locationName: '',
  totalCheckpoints: 0,
};

export const mockEventsList: EventConfig[] = [];

export const mockTeams: Team[] = [];

export const mockCheckpoints: Checkpoint[] = [];

export const mockMarshals: Marshal[] = [];

export const mockLeaderboard: LeaderboardEntry[] = [];

export const mockUserProfiles: Record<UserRole, UserProfile> = {
  participant: {
    id: '',
    name: '',
    role: 'participant',
  },
  crew: {
    id: '',
    name: '',
    role: 'crew',
  },
  admin: {
    id: '',
    name: '',
    role: 'admin',
  },
};



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

export interface EventConfig {
  id: string;
  name: string;
  joinCode?: string;
  date: string;
  maxDurationSeconds: number;
  locationName: string;
  totalCheckpoints: number;
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
// 2. Mock Data Implementation
// ==========================================

export const mockEvent: EventConfig = {
  id: 'EV-001',
  name: 'XploreQuest: Cabaran Tasik Titiwangsa',
  joinCode: 'XT2026',
  date: '27 Jun 2026',
  maxDurationSeconds: 14400, // 4 Jam had masa maksimum
  locationName: 'Taman Tasik Titiwangsa, Kuala Lumpur',
  totalCheckpoints: 8,
};

export const mockEventsList: EventConfig[] = [
  mockEvent,
  {
    id: 'EV-002',
    name: 'XploreQuest: Cabaran Geopark Langkawi',
    joinCode: 'GL2026',
    date: '15 Ogos 2026',
    maxDurationSeconds: 18000,
    locationName: 'Kilim Karst Geoforest Park, Langkawi',
    totalCheckpoints: 6,
  }
];


export const mockTeams: Team[] = [
  {
    id: 'TEAM-001',
    name: 'Pasukan Harimau',
    status: 'approved',
    memberCount: 4,
    startCheckpointId: 'CP-001',
    currentCheckpointId: 'CP-003',
    completedCheckpointIds: ['CP-001', 'CP-002'],
    skippedCheckpointIds: [],
    leaderName: 'Ali bin Abu',
    membersList: 'Abu, Ahmad, Amin',
    phone: '+6012-3456789',
  },
  {
    id: 'TEAM-002',
    name: 'Team Garuda Malaysia',
    status: 'approved',
    memberCount: 5,
    startCheckpointId: 'CP-002',
    currentCheckpointId: 'CP-004',
    completedCheckpointIds: ['CP-002'],
    skippedCheckpointIds: ['CP-003'], // Skipped CP3 due to congestion
    leaderName: 'Muhammad Faiz',
    membersList: 'Hafiz, Zulkifli, Amirul, Daniel',
    phone: '+6019-8765432',
  },
  {
    id: 'TEAM-003',
    name: 'Bintang Selat',
    status: 'approved',
    memberCount: 3,
    startCheckpointId: 'CP-003',
    currentCheckpointId: 'CP-003',
    completedCheckpointIds: [],
    skippedCheckpointIds: [],
    leaderName: 'Siti Sarah',
    membersList: 'Aisyah, Norhayati',
    phone: '+6017-1234567',
  },
  {
    id: 'TEAM-004',
    name: 'Rimba Rangers',
    status: 'approved',
    memberCount: 6,
    startCheckpointId: 'CP-004',
    currentCheckpointId: 'CP-007',
    completedCheckpointIds: ['CP-004', 'CP-005', 'CP-006'],
    skippedCheckpointIds: [],
    leaderName: 'John Doe',
    membersList: 'Michael, Robert, William, David, Richard',
    phone: '+6011-55566677',
  },
  {
    id: 'TEAM-005',
    name: 'Wira Selatan',
    status: 'pending', // Pending Admin approval to start
    memberCount: 4,
    startCheckpointId: 'CP-001',
    currentCheckpointId: 'CP-001',
    completedCheckpointIds: [],
    skippedCheckpointIds: [],
    leaderName: 'Megat Iskandar',
    membersList: 'Firdaus, Syahmi, Khairul',
    phone: '+6018-9998887',
  },
  {
    id: 'TEAM-006',
    name: 'Helang Gunung',
    status: 'approved',
    memberCount: 2,
    startCheckpointId: 'CP-005',
    currentCheckpointId: 'CP-006',
    completedCheckpointIds: ['CP-005'],
    skippedCheckpointIds: [],
    leaderName: 'Zulkarnain',
    membersList: 'Helmi',
    phone: '+6013-4445556',
  },
  {
    id: 'TEAM-007',
    name: 'Kancil Pintar',
    status: 'approved',
    memberCount: 3,
    startCheckpointId: 'CP-006',
    currentCheckpointId: 'CP-008',
    completedCheckpointIds: ['CP-006', 'CP-007'],
    skippedCheckpointIds: [],
    leaderName: 'Wan Azlina',
    membersList: 'Wan Azman, Wan Azmi',
    phone: '+6016-8889990',
  },
  {
    id: 'TEAM-008',
    name: 'Panglima Tasik',
    status: 'pending', // Pending Admin approval to start
    memberCount: 5,
    startCheckpointId: 'CP-002',
    currentCheckpointId: 'CP-002',
    completedCheckpointIds: [],
    skippedCheckpointIds: [],
    leaderName: 'Shahrul Anuar',
    membersList: 'Azlan, Farid, Kamal, Nazri',
    phone: '+6014-2223334',
  },
];

export const mockCheckpoints: Checkpoint[] = [
  {
    id: 'CP-001',
    name: 'Pintu Masuk Utama (Main Fountain)',
    latitude: 3.1764,
    longitude: 101.7061,
    clueText: 'Mula di mana bendera berkibar megah, cari kelibat Marshal berhampiran pancutan air besar.',
    taskDescription: 'Sahkan pendaftaran & tandatangan akuan keselamatan digital.',
    scorePoints: 100,
    statusPerTeam: {
      'TEAM-001': 'completed',
      'TEAM-002': 'locked',
      'TEAM-003': 'locked',
      'TEAM-004': 'completed',
      'TEAM-005': 'active',
      'TEAM-006': 'locked',
      'TEAM-007': 'locked',
    },
    isStart: true,
  },

  {
    id: 'CP-002',
    name: 'Jambatan Gantung Titiwangsa',
    latitude: 3.1748,
    longitude: 101.7075,
    clueText: 'Seberangi laluan bergoyang merentasi air tenang. Marshal menanti di pondok hujung jambatan.',
    taskDescription: 'Tangkap satu gambar wefie kumpulan di tengah jambatan & muat naik bukti.',
    scorePoints: 150,
    statusPerTeam: {
      'TEAM-001': 'completed',
      'TEAM-002': 'completed',
      'TEAM-003': 'locked',
      'TEAM-004': 'completed',
      'TEAM-005': 'locked',
      'TEAM-006': 'locked',
      'TEAM-007': 'locked',
    },
  },
  {
    id: 'CP-003',
    name: 'Taman Laman Flora',
    latitude: 3.1751,
    longitude: 101.7092,
    clueText: 'Dikelilingi haruman bunga orkid & kemboja. Cari petunjuk di belakang pasu tanah liat terbesar.',
    taskDescription: 'Selesaikan teka-teki pantun klasik Melayu berkenaan bunga kebangsaan.',
    scorePoints: 120,
    statusPerTeam: {
      'TEAM-001': 'active',
      'TEAM-002': 'pending', // Skipped! Marked as pending (⚠️)
      'TEAM-003': 'active',
      'TEAM-004': 'locked',
      'TEAM-005': 'locked',
      'TEAM-006': 'locked',
      'TEAM-007': 'locked',
    },
  },
  {
    id: 'CP-004',
    name: 'Dataran Kereta Kuda',
    latitude: 3.1732,
    longitude: 101.7088,
    clueText: 'Tempat berteduh haiwan perkasa pembawa pelancong. Cari Marshal berdekatan kandang kuda.',
    taskDescription: 'Ahli kumpulan dikehendaki melakukan 20 kali lompatan bintang (Star Jumps) serentak.',
    scorePoints: 100,
    statusPerTeam: {
      'TEAM-001': 'locked',
      'TEAM-002': 'active',
      'TEAM-003': 'locked',
      'TEAM-004': 'completed',
      'TEAM-005': 'locked',
      'TEAM-006': 'locked',
      'TEAM-007': 'locked',
    },
  },
  {
    id: 'CP-005',
    name: 'Pusat Rekreasi Air (Kayak)',
    latitude: 3.1721,
    longitude: 101.7042,
    clueText: 'Tempat kayak dan bot berlabuh di tebing tasik. Cari Marshal di hujung pelantar terapung.',
    taskDescription: 'Ikat dua jenis simpulan tali utama: Simpul Buku Sila (Square Knot) & Simpul Manuk (Clove Hitch).',
    scorePoints: 200,
    statusPerTeam: {
      'TEAM-001': 'locked',
      'TEAM-002': 'locked',
      'TEAM-003': 'locked',
      'TEAM-004': 'completed',
      'TEAM-005': 'locked',
      'TEAM-006': 'completed',
      'TEAM-007': 'locked',
    },
  },
  {
    id: 'CP-006',
    name: 'Taman Canopy Walk',
    latitude: 3.1772,
    longitude: 101.7025,
    clueText: 'Laluan kanopi hijau di celah rimbunan dahan. Kod QR diletakkan di tiang sokongan ketiga.',
    taskDescription: 'Imbas QR kod dan namakan 3 jenis serangga hutan yang dipaparkan dalam aplikasi.',
    scorePoints: 120,
    statusPerTeam: {
      'TEAM-001': 'locked',
      'TEAM-002': 'locked',
      'TEAM-003': 'locked',
      'TEAM-004': 'completed',
      'TEAM-005': 'locked',
      'TEAM-006': 'active',
      'TEAM-007': 'completed',
    },
  },
  {
    id: 'CP-007',
    name: 'Laluan Basikal Utara',
    latitude: 3.1795,
    longitude: 101.7048,
    clueText: 'Roda berputar laju di sini. Cari papan penanda kilometer 1.5 berdekatan kedai sewa basikal.',
    taskDescription: 'Dapatkan kod dekripsi kripto ringkas untuk meleraikan koordinat CP akhir.',
    scorePoints: 150,
    statusPerTeam: {
      'TEAM-001': 'locked',
      'TEAM-002': 'locked',
      'TEAM-003': 'locked',
      'TEAM-004': 'active',
      'TEAM-005': 'locked',
      'TEAM-006': 'locked',
      'TEAM-007': 'completed',
    },
  },
  {
    id: 'CP-008',
    name: 'Astaka Garisan Penamat',
    latitude: 3.178,
    longitude: 101.7068,
    clueText: 'Destinasi terakhir, kubah besar mercu kemenangan. Cari Marshal Utama di atas pentas.',
    taskDescription: 'Imbas Kod QR Dinamik Marshal Terakhir untuk merekod masa penamat rasmi.',
    scorePoints: 300,
    statusPerTeam: {
      'TEAM-001': 'locked',
      'TEAM-002': 'locked',
      'TEAM-003': 'locked',
      'TEAM-004': 'locked',
      'TEAM-005': 'locked',
      'TEAM-006': 'locked',
      'TEAM-007': 'active',
    },
    isFinish: true,
  },

];

export const mockMarshals: Marshal[] = [
  { id: 'MAR-001', name: 'Marshal Ahmad', checkpointId: 'CP-001', phone: '012-3456789', activeQueueCount: 1 },
  { id: 'MAR-002', name: 'Marshal Siti', checkpointId: 'CP-002', phone: '013-9876543', activeQueueCount: 0 },
  { id: 'MAR-003', name: 'Marshal Bala', checkpointId: 'CP-003', phone: '017-4561230', activeQueueCount: 3 },
  { id: 'MAR-004', name: 'Marshal Chong', checkpointId: 'CP-004', phone: '019-7894561', activeQueueCount: 0 },
  { id: 'MAR-005', name: 'Marshal Daniel', checkpointId: 'CP-005', phone: '016-1234567', activeQueueCount: 2 },
  { id: 'MAR-006', name: 'Marshal Eliza', checkpointId: 'CP-006', phone: '011-9876123', activeQueueCount: 1 },
  { id: 'MAR-007', name: 'Marshal Farhan', checkpointId: 'CP-007', phone: '014-3698520', activeQueueCount: 0 },
  { id: 'MAR-008', name: 'Marshal Grace', checkpointId: 'CP-008', phone: '018-7412589', activeQueueCount: 4 },
];

export const mockLeaderboard: LeaderboardEntry[] = [
  {
    teamId: 'TEAM-004',
    teamName: 'Rimba Rangers',
    rank: 1,
    points: 470,
    totalTimeFormatted: '1j 12m',
    penaltiesMinutes: 0,
    isDNF: false,
  },
  {
    teamId: 'TEAM-007',
    teamName: 'Kancil Pintar',
    rank: 2,
    points: 370,
    totalTimeFormatted: '1j 35m',
    penaltiesMinutes: 0,
    isDNF: false,
  },
  {
    teamId: 'TEAM-001',
    teamName: 'Pasukan Harimau',
    rank: 3,
    points: 250,
    totalTimeFormatted: '1j 50m',
    penaltiesMinutes: 5, // 5 Minit denda tersangkut
    isDNF: false,
  },
  {
    teamId: 'TEAM-002',
    teamName: 'Team Garuda Malaysia',
    rank: 4,
    points: 150,
    totalTimeFormatted: '2j 05m',
    penaltiesMinutes: 15,
    isDNF: false,
  },
  {
    teamId: 'TEAM-006',
    teamName: 'Helang Gunung',
    rank: 5,
    points: 100,
    totalTimeFormatted: '2j 45m',
    penaltiesMinutes: 10,
    isDNF: false,
  },
  {
    teamId: 'TEAM-003',
    teamName: 'Bintang Selat',
    rank: 6,
    points: 0,
    totalTimeFormatted: '3j 22m',
    penaltiesMinutes: 0,
    isDNF: false,
  },
  {
    teamId: 'TEAM-005',
    teamName: 'Wira Selatan',
    rank: 7,
    points: 0,
    totalTimeFormatted: 'N/A',
    penaltiesMinutes: 0,
    isDNF: true, // Did Not Finish (Registration expired/Timeout)
  },
];

// Profile data for test-login / demo role swapping
export const mockUserProfiles: Record<UserRole, UserProfile> = {
  participant: {
    id: 'USR-PART-001',
    name: 'Syamil',
    role: 'participant',
    email: 'syamil@pasukanharimau.my',
    teamId: 'TEAM-001', // Link to Pasukan Harimau
  },
  crew: {
    id: 'USR-CREW-002',
    name: 'Puan Nurul Husna',
    role: 'crew',
    email: 'husna@kleventcrew.my',
    checkpointId: 'CP-002', // Stationed at Jambatan Gantung
  },
  admin: {
    id: 'USR-ADMIN-003',
    name: 'Encik Azman',
    role: 'admin',
    email: 'azman@xplorequest.com',
  },
};

// ==========================================
// 3. Runtime Data Normalization & Indexing
// ==========================================

// Pre-sort: Start first, standard middle, Finish last
const sortedCheckpoints = (() => {
  const startCPs = mockCheckpoints.filter(cp => cp.isStart);
  const finishCPs = mockCheckpoints.filter(cp => cp.isFinish);
  const standardCPs = mockCheckpoints.filter(cp => !cp.isStart && !cp.isFinish);
  return [...startCPs, ...standardCPs, ...finishCPs];
})();

// Re-map IDs sequentially: Start -> CP-START, Standard -> CP-001, CP-002..., Finish -> CP-TAMAT
const idMap: Record<string, string> = {};
let standardIndex = 1;

sortedCheckpoints.forEach((cp) => {
  const oldId = cp.id;
  let newId = oldId;
  if (cp.isStart) {
    newId = 'CP-START';
  } else if (cp.isFinish) {
    newId = 'CP-TAMAT';
  } else {
    newId = `CP-${standardIndex.toString().padStart(3, '0')}`;
    standardIndex++;
  }
  idMap[oldId] = newId;
  cp.id = newId;
});

// Re-assign checkpoints array references in-place
mockCheckpoints.length = 0;
mockCheckpoints.push(...sortedCheckpoints);

// Update mockTeams relations to match new checkpoint IDs
mockTeams.forEach(team => {
  team.startCheckpointId = idMap[team.startCheckpointId] || team.startCheckpointId;
  team.currentCheckpointId = idMap[team.currentCheckpointId] || team.currentCheckpointId;
  team.completedCheckpointIds = team.completedCheckpointIds.map(id => idMap[id] || id);
  team.skippedCheckpointIds = team.skippedCheckpointIds.map(id => idMap[id] || id);
});

// Update crew member station checkpoint ID
if (mockUserProfiles.crew && mockUserProfiles.crew.checkpointId) {
  mockUserProfiles.crew.checkpointId = idMap[mockUserProfiles.crew.checkpointId] || mockUserProfiles.crew.checkpointId;
}


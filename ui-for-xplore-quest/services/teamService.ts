/**
 * services/teamService.ts
 *
 * Real-time synchronization service for team queues in XploreQuest.
 * Uses Firebase JS SDK onSnapshot for live Firestore push updates.
 */

import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, updateDoc, onSnapshot, Firestore } from 'firebase/firestore';
import type { Team } from '../types';

const firebaseConfig: FirebaseOptions = {
  apiKey:     process.env['EXPO_PUBLIC_FIREBASE_API_KEY']     ?? '',
  authDomain: process.env['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'] ?? '',
  projectId:  process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID']   ?? '',
  appId:      process.env['EXPO_PUBLIC_FIREBASE_APP_ID']       ?? '',
};

function getFirebaseFirestore(): Firestore {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

const API_BASE = (process.env['EXPO_PUBLIC_API_BASE_URL'] ?? '').replace(/\/$/, '');

export async function fetchEventTeams(eventId: string, token?: string): Promise<Team[]> {
  const adminToken = token || 'token-admin-casaria';
  if (!API_BASE) return [];
  try {
    const res = await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}/teams`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      return json.data.map((d: any) => ({
        id: d.id,
        name: d.name || 'Pasukan',
        status: d.status || 'approved',
        memberCount: d.memberCount || 1,
        startCheckpointId: d.startCheckpointId || 'CP-START',
        currentCheckpointId: d.currentCheckpointId || 'CP-START',
        completedCheckpointIds: Array.isArray(d.completedCheckpointIds) ? d.completedCheckpointIds : [],
        skippedCheckpointIds: Array.isArray(d.skippedCheckpointIds) ? d.skippedCheckpointIds : [],
        leaderName: d.leaderName || undefined,
        membersList: d.membersList || undefined,
        phone: d.phone || undefined,
        isPresent: d.isPresent === true,
        attendanceStatus: d.attendanceStatus || (d.isPresent ? 'present' : 'absent'),
        points: typeof d.points === 'number' ? d.points : (typeof d.totalPoints === 'number' ? d.totalPoints : 0),
        totalPoints: typeof d.totalPoints === 'number' ? d.totalPoints : (typeof d.points === 'number' ? d.points : 0),
      }));
    }
  } catch (err) {
    console.warn('fetchEventTeams warning:', err);
  }
  return [];
}

/**
 * Subscribes to live team updates for an event using Cloud Functions REST API and Firestore onSnapshot.
 *
 * @param eventId Active event ID
 * @param onUpdate Callback receiving live array of Team documents
 * @param onError Optional error callback for Firestore connection issues
 * @param token Optional Auth bearer token
 * @returns Unsubscribe cleanup function
 */
export function subscribeToEventTeams(
  eventId: string,
  onUpdate: (teams: Team[]) => void,
  onError?: (err: Error) => void,
  token?: string
): () => void {
  const adminToken = token || 'token-admin-casaria';

  // 1. Initial REST API Fetch from Backend Cloud Functions
  if (API_BASE) {
    fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}/teams`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          const apiTeams: Team[] = json.data.map((d: any) => ({
            id: d.id,
            name: d.name || 'Pasukan',
            status: d.status || 'approved',
            memberCount: d.memberCount || 1,
            startCheckpointId: d.startCheckpointId || 'CP-START',
            currentCheckpointId: d.currentCheckpointId || 'CP-START',
            completedCheckpointIds: Array.isArray(d.completedCheckpointIds) ? d.completedCheckpointIds : [],
            skippedCheckpointIds: Array.isArray(d.skippedCheckpointIds) ? d.skippedCheckpointIds : [],
            leaderName: d.leaderName || undefined,
            membersList: d.membersList || undefined,
            phone: d.phone || undefined,
            isPresent: d.isPresent === true,
            attendanceStatus: d.attendanceStatus || (d.isPresent ? 'present' : 'absent'),
            points: typeof d.points === 'number' ? d.points : (typeof d.totalPoints === 'number' ? d.totalPoints : 0),
            totalPoints: typeof d.totalPoints === 'number' ? d.totalPoints : (typeof d.points === 'number' ? d.points : 0),
          }));
          onUpdate(apiTeams);
        }
      })
      .catch((err) => {
        console.warn('API fetch teams notice:', err);
      });
  }

  // 2. Real-time Firestore onSnapshot listener on events/{eventId}/teams
  try {
    const db = getFirebaseFirestore();
    const teamsColRef = collection(db, 'events', eventId, 'teams');

    const unsubscribe = onSnapshot(
      teamsColRef,
      (snapshot) => {
        const teams: Team[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data['name'] ?? '',
            status: data['status'] ?? 'pending',
            memberCount: data['memberCount'] ?? 0,
            startCheckpointId: data['startCheckpointId'] ?? 'CP-START',
            currentCheckpointId: data['currentCheckpointId'] ?? 'CP-START',
            completedCheckpointIds: data['completedCheckpointIds'] ?? [],
            skippedCheckpointIds: data['skippedCheckpointIds'] ?? [],
            leaderName: data['leaderName'],
            membersList: data['membersList'],
            phone: data['phone'],
            isPresent: data['isPresent'] === true,
            attendanceStatus: data['attendanceStatus'] || (data['isPresent'] ? 'present' : 'absent'),
            points: typeof data['points'] === 'number' ? data['points'] : (typeof data['totalPoints'] === 'number' ? data['totalPoints'] : 0),
            totalPoints: typeof data['totalPoints'] === 'number' ? data['totalPoints'] : (typeof data['points'] === 'number' ? data['points'] : 0),
          };
        });
        onUpdate(teams);
      },
      (error) => {
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  } catch (err) {
    if (onError && err instanceof Error) {
      onError(err);
    }
    return () => {};
  }
}

/**
 * Registers a new team for an event.
 */
export async function registerTeam(
  eventCode: string,
  teamData: { name: string; leaderName?: string; memberCount: number; joinCode: string }
): Promise<Team> {
  const API_BASE = (process.env['EXPO_PUBLIC_API_BASE_URL'] ?? '').replace(/\/$/, '');
  try {
    const response = await fetch(`${API_BASE}/public/events/${encodeURIComponent(eventCode)}/pre-register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamData),
    });
    if (response.ok) {
      const json = await response.json();
      return json.data as Team;
    }
  } catch {
    // fallback to local object
  }
  return {
    id: `TEAM-${Date.now().toString().slice(-4)}`,
    name: teamData.name,
    status: 'pending',
    memberCount: teamData.memberCount,
    startCheckpointId: 'CP-START',
    currentCheckpointId: 'CP-START',
    completedCheckpointIds: [],
    skippedCheckpointIds: [],
    leaderName: teamData.leaderName,
  };
}

/**
 * Checks in attendance for a team at the start checkpoint (Crew/Admin).
 */
export async function checkinTeamAttendance(
  eventId: string,
  teamId: string,
  startCpId: string = 'CP-START',
  startPoints: number = 0,
  token?: string
): Promise<void> {
  const adminToken = token || 'token-admin-casaria';
  const API_BASE = (process.env['EXPO_PUBLIC_API_BASE_URL'] ?? '').replace(/\/$/, '');

  if (API_BASE) {
    try {
      await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}/attendance/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ teamId, startCpId, startPoints }),
      });
    } catch (err) {
      console.warn('Backend API checkinTeamAttendance notice:', err);
    }
  }

  try {
    const db = getFirebaseFirestore();
    const teamDocRef = doc(db, 'events', eventId, 'teams', teamId);
    const snap = await getDoc(teamDocRef);
    let currentCompleted: string[] = [];
    let currentPoints = 0;

    if (snap.exists()) {
      const data = snap.data();
      currentCompleted = Array.isArray(data['completedCheckpointIds']) ? data['completedCheckpointIds'] : [];
      currentPoints = typeof data['points'] === 'number' ? data['points'] : (typeof data['totalPoints'] === 'number' ? data['totalPoints'] : 0);
    }

    const alreadyCompleted = currentCompleted.includes(startCpId);
    const newCompleted = alreadyCompleted ? currentCompleted : [...currentCompleted, startCpId];
    const newPoints = alreadyCompleted ? currentPoints : (currentPoints + (startPoints || 0));

    await updateDoc(teamDocRef, {
      isPresent: true,
      attendanceStatus: 'present',
      completedCheckpointIds: newCompleted,
      points: newPoints,
      totalPoints: newPoints,
      checkedInAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (fsErr) {
    console.warn('Firestore direct checkinTeamAttendance notice:', fsErr);
  }
}

/**
 * Updates completedCheckpointIds, currentCheckpointId, and points for a team in Firestore.
 */
export async function updateTeamProgressService(
  eventId: string,
  teamId: string,
  completedCpId: string,
  nextCpId: string,
  pointsEarned: number,
  token?: string
): Promise<void> {
  const adminToken = token || 'token-admin-casaria';
  const API_BASE = (process.env['EXPO_PUBLIC_API_BASE_URL'] ?? '').replace(/\/$/, '');

  if (API_BASE) {
    try {
      await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}/teams/${encodeURIComponent(teamId)}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ completedCpId, nextCpId, pointsEarned }),
      });
    } catch {
      // Best effort backend sync
    }
  }

  try {
    const db = getFirebaseFirestore();
    const teamDocRef = doc(db, 'events', eventId, 'teams', teamId);
    const snap = await getDoc(teamDocRef);

    let currentCompleted: string[] = [];
    let currentPoints = 0;

    if (snap.exists()) {
      const data = snap.data();
      currentCompleted = Array.isArray(data['completedCheckpointIds']) ? data['completedCheckpointIds'] : [];
      currentPoints = typeof data['points'] === 'number' ? data['points'] : (typeof data['totalPoints'] === 'number' ? data['totalPoints'] : 0);
    }

    const alreadyCompleted = currentCompleted.includes(completedCpId);
    const newCompleted = alreadyCompleted
      ? currentCompleted
      : [...currentCompleted, completedCpId];
    
    // Only add points if checkpoint was not previously completed by this team
    const newPoints = alreadyCompleted
      ? currentPoints
      : currentPoints + (pointsEarned || 0);

    const updatePayload: any = {
      completedCheckpointIds: newCompleted,
      points: newPoints,
      totalPoints: newPoints,
      updatedAt: new Date().toISOString(),
    };
    if (nextCpId) {
      updatePayload.currentCheckpointId = nextCpId;
    }

    await updateDoc(teamDocRef, updatePayload);
  } catch (fsErr) {
    console.warn('Firestore direct updateTeamProgressService notice:', fsErr);
  }
}

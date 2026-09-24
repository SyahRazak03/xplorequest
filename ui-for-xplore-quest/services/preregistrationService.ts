/**
 * services/preregistrationService.ts
 *
 * Real-time and REST service for web pre-registrations in XploreQuest.
 * Fetches, approves, and rejects team registration applications submitted via the public web form.
 */

import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  Firestore,
} from 'firebase/firestore';
import type { Team } from '../types';

export interface PreRegistrationItem {
  id: string;
  eventId: string;
  teamName: string;
  leaderName: string;
  leaderPhone: string;
  memberNames: string[];
  memberCount: number;
  paymentReceiptUrl?: string;
  paymentReceiptStoragePath?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  rejectionReason?: string;
  teamId?: string;
}

const firebaseConfig: FirebaseOptions = {
  apiKey:     process.env['EXPO_PUBLIC_FIREBASE_API_KEY']     ?? '',
  authDomain: process.env['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'] ?? '',
  projectId:  process.env['EXPO_PUBLIC_FIREBASE_PROJECT_ID']   ?? '',
  appId:      process.env['EXPO_PUBLIC_FIREBASE_APP_ID']       ?? '',
};

const API_BASE = (process.env['EXPO_PUBLIC_API_BASE_URL'] ?? '').replace(/\/$/, '');

function getFirebaseFirestore(): Firestore {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return getFirestore(app);
}

/**
 * Formats a raw receipt URL or storage path to a working Firebase Storage public download URL.
 * Converts direct Google Cloud Storage URLs (`https://storage.googleapis.com/...`) to
 * Firebase Storage media endpoint (`https://firebasestorage.googleapis.com/v0/b/.../o/...UrlEncoded?alt=media`).
 */
export function formatReceiptUrl(rawUrl?: string, storagePath?: string): string | undefined {
  if (storagePath) {
    const bucketName = 'xplorequest-cab6c.firebasestorage.app';
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;
  }

  if (rawUrl) {
    if (rawUrl.startsWith('data:image')) {
      return rawUrl;
    }
    if (rawUrl.includes('firebasestorage.googleapis.com')) {
      return rawUrl;
    }
    if (rawUrl.includes('storage.googleapis.com/')) {
      const match = rawUrl.match(/storage\.googleapis\.com\/([^/]+)\/(.+)$/);
      if (match) {
        const bucket = match[1];
        const objectPath = match[2];
        return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media`;
      }
    }
    return rawUrl;
  }

  return undefined;
}

/**
 * Subscribes to live pre-registrations for an event.
 * Queries Cloud API backend first, with real-time Firestore fallback listener.
 */
export function subscribeToPreRegistrations(
  eventId: string,
  onUpdate: (items: PreRegistrationItem[]) => void,
  onError?: (err: Error) => void,
  token?: string
): () => void {
  const adminToken = token || 'token-admin-casaria';

  // 1. Initial REST API Fetch from Backend Cloud Functions
  if (API_BASE) {
    fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}/pre-registrations`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          const apiItems: PreRegistrationItem[] = json.data.map((d: any) => ({
            id: d.id,
            eventId: d.eventId || eventId,
            teamName: d.teamName || 'Team',
            leaderName: d.leaderName || 'Leader',
            leaderPhone: d.leaderWhatsApp || d.leaderPhone || '',
            memberNames: Array.isArray(d.memberNames) ? d.memberNames : [],
            memberCount: d.memberCount || 1 + (Array.isArray(d.memberNames) ? d.memberNames.length : 0),
            paymentReceiptUrl: formatReceiptUrl(d.paymentReceiptUrl, d.paymentReceiptStoragePath),
            paymentReceiptStoragePath: d.paymentReceiptStoragePath || undefined,
            status: d.status || 'pending',
            submittedAt: d.submittedAt || d.createdAt || new Date().toISOString(),
            rejectionReason: d.rejectionReason || undefined,
            teamId: d.teamId || undefined,
          }));
          onUpdate(apiItems);
        }
      })
      .catch((err) => {
        console.warn('API fetch pre-registrations notice:', err);
      });
  }

  // 2. Real-time Firestore onSnapshot listener on events/{eventId}/preRegistrations
  try {
    const db = getFirebaseFirestore();
    const colRef = collection(db, 'events', eventId, 'preRegistrations');

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const items: PreRegistrationItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const members = Array.isArray(data['memberNames']) ? data['memberNames'] : [];
          return {
            id: docSnap.id,
            eventId,
            teamName: data['teamName'] ?? '',
            leaderName: data['leaderName'] ?? '',
            leaderPhone: data['leaderWhatsApp'] ?? data['leaderPhone'] ?? '',
            memberNames: members,
            memberCount: data['memberCount'] ?? (1 + members.length),
            paymentReceiptUrl: formatReceiptUrl(data['paymentReceiptUrl'], data['paymentReceiptStoragePath']),
            paymentReceiptStoragePath: data['paymentReceiptStoragePath'],
            status: data['status'] ?? 'pending',
            submittedAt: data['submittedAt'] || data['createdAt'] || new Date().toISOString(),
            rejectionReason: data['rejectionReason'],
            teamId: data['teamId'],
          };
        });
        onUpdate(items);
      },
      (error) => {
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err) {
    if (onError && err instanceof Error) onError(err);
    return () => {};
  }
}

/**
 * Approves a pre-registration:
 * 1. Invokes backend Cloud API PATCH /events/:eventId/pre-registrations/:id/approve
 * 2. Updates preRegistrations document status to 'approved'
 * 3. Creates an approved Team document in events/{eventId}/teams/{teamId}
 */
export async function approvePreRegistration(
  eventId: string,
  preReg: PreRegistrationItem,
  token?: string
): Promise<Team> {
  const adminToken = token || 'token-admin-casaria';
  let createdTeam: Team | null = null;

  // 1. Call Cloud API Backend to approve pre-registration and create team
  if (API_BASE) {
    try {
      const resp = await fetch(
        `${API_BASE}/events/${encodeURIComponent(eventId)}/pre-registrations/${encodeURIComponent(preReg.id)}/approve`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );
      const json = await resp.json();
      if (resp.ok && json.success && json.data) {
        const d = json.data;
        createdTeam = {
          id: d.id || `TEAM-${Math.floor(Math.random() * 9000 + 1000)}`,
          name: d.name || preReg.teamName,
          status: 'approved',
          memberCount: d.memberCount || preReg.memberCount,
          startCheckpointId: 'CP-START',
          currentCheckpointId: 'CP-START',
          completedCheckpointIds: [],
          skippedCheckpointIds: [],
          leaderName: preReg.leaderName,
          membersList: preReg.memberNames.join(', '),
          phone: preReg.leaderPhone,
          isPresent: d.isPresent === true,
          attendanceStatus: d.attendanceStatus || 'absent',
        };
      }
    } catch (err) {
      console.warn('Backend API approvePreRegistration notice:', err);
    }
  }

  const db = getFirebaseFirestore();
  const teamId = createdTeam?.id || preReg.teamId || `TEAM-${Math.floor(Math.random() * 9000 + 1000)}`;

  const newTeam: Team = createdTeam || {
    id: teamId,
    name: preReg.teamName,
    status: 'approved',
    memberCount: preReg.memberCount || 1 + preReg.memberNames.length,
    startCheckpointId: 'CP-START',
    currentCheckpointId: 'CP-START',
    completedCheckpointIds: [],
    skippedCheckpointIds: [],
    leaderName: preReg.leaderName,
    membersList: preReg.memberNames.join(', '),
    phone: preReg.leaderPhone,
    isPresent: false,
    attendanceStatus: 'absent',
  };

  // 2. Create team document in Firestore (only if Cloud Function API fallback needed)
  if (!createdTeam) {
    try {
      const teamDocRef = doc(db, 'events', eventId, 'teams', teamId);
      await setDoc(teamDocRef, {
        ...newTeam,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 3. Update preRegistrations document status
      const preRegDocRef = doc(db, 'events', eventId, 'preRegistrations', preReg.id);
      await updateDoc(preRegDocRef, {
        status: 'approved',
        teamId: teamId,
        updatedAt: new Date().toISOString(),
      });
    } catch (fsErr) {
      console.warn('Firestore direct write notice:', fsErr);
    }
  }

  return newTeam;
}

/**
 * Rejects a pre-registration with optional reason.
 */
export async function rejectPreRegistration(
  eventId: string,
  preRegId: string,
  reason?: string,
  token?: string
): Promise<void> {
  const adminToken = token || 'token-admin-casaria';

  if (API_BASE) {
    try {
      await fetch(
        `${API_BASE}/events/${encodeURIComponent(eventId)}/pre-registrations/${encodeURIComponent(preRegId)}/reject`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ reason: reason || 'Registration rejected by organizer.' }),
        }
      );
    } catch (err) {
      console.warn('Backend API rejectPreRegistration notice:', err);
    }
  }

  try {
    const db = getFirebaseFirestore();
    const preRegDocRef = doc(db, 'events', eventId, 'preRegistrations', preRegId);
    await updateDoc(preRegDocRef, {
      status: 'rejected',
      rejectionReason: reason || 'Registration rejected by organizer.',
      updatedAt: new Date().toISOString(),
    });
  } catch (fsErr) {
    console.warn('Firestore direct update notice:', fsErr);
  }
}
